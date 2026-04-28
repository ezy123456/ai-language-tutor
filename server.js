process.on('unhandledRejection', (reason, promise) => {
    console.error('--- Unhandled Rejection at: ---');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
});

console.log('--- Server Started ---');
require('dotenv').config(); 
const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pool = require('./db');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const app = express();
const port = 3000;
const cors = require('cors');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'secret-key', 
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function isAuthenticated(req, res, next) {
    if (req.session && req.session.user && req.session.user.id) {
        next();
    } else {
        res.status(401).json({ message: 'Tidak terautentikasi. Silakan login.' });
        
    }
}

app.post('/generate-content', async (req, res) => {
    const userPrompt = req.body.prompt;

    if (!userPrompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash', 
            contents: [{
                parts: [{
                    text: userPrompt
                }]
            }]
        });

        if (response && response.text) {
            let generatedContent = response.text;

            let parsedContent = null;
            const jsonMatch = generatedContent.match(/```json\n([\s\S]*?)\n```/);

            if (jsonMatch && jsonMatch[1]) {
                try {
                    parsedContent = JSON.parse(jsonMatch[1].trim()); 
                } catch (parseError) {
                    console.error('Error parsing extracted JSON:', parseError.message);
                    console.error('Content that failed parsing after extraction:', jsonMatch[1].trim());
                }
            }

            if (parsedContent) {
                return res.json({ generatedContent: parsedContent });
            } else {
                console.warn('Warning: No valid JSON block found or parsing failed. Sending raw text as fallback.');
                console.warn('Raw content from Gemini:', generatedContent);
                return res.json({ generatedContent: generatedContent });
            }

        } else {
            res.status(500).json({ error: 'Error from Gemini API: No generated content received.' });
        }
    } catch (err) {
        console.error('Error generating content from Gemini API:', err.message);
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error when generating content from AI. Check server logs for details.' });
    }
});

app.get('/api/get-prompt', async (req, res) => {
    const { promptName } = req.query; 

    if (!promptName) {
        return res.status(400).json({ message: 'Parameter promptName is required.' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const [rows] = await conn.execute('SELECT teks_prompt FROM prompts WHERE nama_prompt = ?', [promptName]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Prompt not found.' });
        }

        res.json({ teks_prompt: rows[0].teks_prompt });
    } catch (error) {
        console.error('Error fetching prompt from database:', error);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (conn) conn.release();
    }
});


app.get('/generate-vocabulary', async (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        return res.status(401).send('You need to log in');
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const selectedWord = req.query.word;

       
        const [promptRows] = await conn.execute('SELECT teks_prompt FROM prompts WHERE nama_prompt = ?', ['vocabulary_example_prompt']);
        if (promptRows.length === 0) {
            throw new Error('Prompt "vocabulary_example_prompt" not found in database.');
        }
        const basePrompt = promptRows[0].teks_prompt;

        
        const prompt = basePrompt.replace('[WORD]', selectedWord);

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash', 
            contents: [{
                parts: [{ text: prompt }]
            }]
        });

        if (response && response.text) {
            res.json({ exampleSentence: response.text });
        } else {
            res.status(500).send('Error generating vocabulary example');
        }
    } catch (err) {
        console.error('Error generating vocabulary example:', err);
        res.status(500).send('Error generating vocabulary example');
    } finally {
        if (conn) conn.release();
    }
});


app.get('/profile/score-history', isAuthenticated, async (req, res) => {
    console.log('--- /profile/score-history endpoint hit ---');
    const userId = req.session.user.id; 
    let conn;
    try {
        conn = await pool.getConnection();
        const [rows] = await conn.execute( 
            `SELECT score, submission_date AS created_at FROM user_quiz_results WHERE user_id = ? ORDER BY submission_date ASC`,
            [userId]
        );
        conn.release();

        const dates = rows.map(row => {
            const date = new Date(row.created_at);
            return date.toLocaleDateString('id-ID'); 
        });
        const scores = rows.map(row => row.score);

        res.status(200).json({ dates, scores });
    } catch (error) {
        console.error('Error fetching score history:', error);
        res.status(500).json({ message: 'Gagal memuat riwayat skor kuis.' });
    } finally {
        if (conn) conn.release();
    }
});

app.get('/profile/quiz-stats', isAuthenticated, async (req, res) => {
    console.log('--- /profile/quiz-stats endpoint hit ---');
    const userId = req.session.user.id; 
    let conn;
    try {
        conn = await pool.getConnection();

        const [quizStatsRows] = await conn.execute(
            `SELECT
                COUNT(id) AS total_quizzes,
                MAX(score) AS best_score,
                MIN(score) AS lowest_score,
                AVG(score) AS average_score,
                SUM(correct_answers_count) AS total_correct_answers,
                SUM(incorrect_answers_count) AS total_incorrect_answers
            FROM user_quiz_results
            WHERE user_id = ?`,
            [userId]
        );
        const quizStats = quizStatsRows[0] || {};

        const stats = { ...quizStats };

        let quizStreakPercentage = null;
        if (stats.total_quizzes > 0) {
            const [perfectQuizzes] = await conn.execute( 
                `SELECT COUNT(id) AS perfect_count FROM user_quiz_results WHERE user_id = ? AND score = 100`, 
                [userId]
            );
            if (perfectQuizzes[0].perfect_count > 0) {
                quizStreakPercentage = ((perfectQuizzes[0].perfect_count / stats.total_quizzes) * 100).toFixed(2);
            }
        }
        stats.quiz_streak_percentage = quizStreakPercentage;

        res.status(200).json(stats);
    } catch (error) {
        console.error('Error fetching quiz stats:', error);
        res.status(500).json({ message: 'Gagal memuat statistik kuis.' });
    } finally {
        if (conn) conn.release();
    }
});


app.get('/profile/learning-progress', isAuthenticated, async (req, res) => {
    console.log('--- /profile/learning-progress endpoint hit ---');
    const userId = req.session.user.id; 
    let conn;
    try {
        conn = await pool.getConnection();

       
        const [learningProgressByLevel] = await conn.execute(
            `SELECT q.level, AVG(uqr.score) as average_score
             FROM user_quiz_results uqr
             JOIN quizzes q ON uqr.quiz_id = q.id
             WHERE uqr.user_id = ?
             GROUP BY q.level`, 
            [userId]
        );

        const formattedProgress = {};
        if (learningProgressByLevel.length > 0) {
            learningProgressByLevel.forEach(row => {
                formattedProgress[row.level] = parseFloat(row.average_score); 
            });
        }

        res.status(200).json({
            learning_progress_by_level: formattedProgress
        });
    } catch (error) {
        console.error('Error fetching learning progress:', error);
        res.status(500).json({ message: 'Gagal memuat progres pembelajaran.' });
    } finally {
        if (conn) conn.release();
    }
});


app.get('/profile/rewards', isAuthenticated, async (req, res) => {
    console.log('--- /profile/rewards endpoint hit ---');
    const userId = req.session.user.id; 
    let conn;
    try {
        conn = await pool.getConnection();

        const [userRewards] = await conn.execute(
            `SELECT a.name, a.description, a.icon_url
             FROM achievements a
             JOIN user_achievements ua ON a.id = ua.achievement_id
             WHERE ua.user_id = ?
             ORDER BY ua.achieved_at DESC`,
            [userId]
        );

        res.status(200).json(userRewards);
    } catch (error) {
        console.error('Error fetching rewards:', error);
        res.status(500).json({ message: 'Gagal memuat pencapaian.' });
    } finally {
        if (conn) conn.release();
    }
});



app.post('/register', async (req, res) => {
    const { username, password, level } = req.body;
    let conn;
    try {
        conn = await pool.getConnection(); 
        const queryCheckUser = 'SELECT * FROM users WHERE username = ?';
        const [userResults] = await conn.execute(queryCheckUser, [username]); 

        if (userResults.length > 0) {
            return res.status(400).send('Username already taken');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const queryInsert = 'INSERT INTO users (username, password, level) VALUES (?, ?, ?)';
        await conn.execute(queryInsert, [username, hashedPassword, level]);

        res.status(201).send('User registered successfully');
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).send('Error during registration');
    } finally {
        if (conn) conn.release();
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    let conn;
    try {
        conn = await pool.getConnection(); 
        const query = 'SELECT * FROM users WHERE username = ?';
        const [userResults] = await conn.execute(query, [username]); 

        if (userResults.length === 0) {
            return res.status(400).send('User not found');
        }
        
        const user = userResults[0];

        // Periksa password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid password');
        }

       
        req.session.user = { id: user.id, username: user.username, level: user.level };

      
        return res.json({
            success: true,
            user: { id: user.id, username: user.username, level: user.level }
        });
    } catch (err) {
        console.error('Error during login:', err);
        return res.status(500).send('Error during login');
    } finally {
        if (conn) conn.release();
    }
});



app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(400).send('Unable to logout');
        }
        res.send('Logged out successfully');
    });
});


app.get('/learning', async (req, res) => {
    if (!req.session.user || !req.session.user.id) { 
        return res.status(401).send('You need to log in');
    }

    let conn;
    try {
        conn = await pool.getConnection(); 
        
        const userLevel = req.session.user.level;

        
        const query = 'SELECT * FROM vocabulary WHERE level = ?';
        const [vocabularyResults] = await conn.execute(query, [userLevel]); 

        res.json(vocabularyResults); 
    } catch (err) {
        console.error('Error fetching vocabulary:', err);
        res.status(500).send('Error fetching vocabulary');
    } finally {
        if (conn) conn.release();
    }
});

app.post('/quiz', async (req, res) => {
    const { question, level, correct_answer, options } = req.body; 
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [result] = await conn.execute(
            'INSERT INTO quizzes (question, level, correct_answer) VALUES (?, ?, ?)', 
            [question, level, correct_answer]
        );

        const quizId = result.insertId;

        const optionPromises = options.map(opt =>
            conn.execute('INSERT INTO quiz_options (quiz_id, option_text) VALUES (?, ?)', [quizId, opt])
        );

        await Promise.all(optionPromises);

        await conn.commit();
        res.status(201).json({ message: 'Soal quiz berhasil dibuat', quizId });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error(err);
        res.status(500).json({ error: 'Gagal membuat soal quiz' });
    } finally {
        if (conn) conn.release();
    }
});



app.get('/quiz', async (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        return res.status(401).json({ error: 'Anda harus login terlebih dahulu' });
    }

    const userLevel = req.session.user.level;
    let conn;
    try {
        conn = await pool.getConnection();
        const query = `
            SELECT id, question, correct_answer, level FROM quizzes // Ambil kolom yang relevan dari tabel quizzes
            WHERE level = ?
            LIMIT 5
        `;
        const [quizzes] = await conn.execute(query, [userLevel]);

        console.log("Quizzes yang diterima dari database:", quizzes);

        for (const quiz of quizzes) {
            const [options] = await conn.execute( 
                'SELECT option_text FROM quiz_options WHERE quiz_id = ?',
                [quiz.id]
            );
            quiz.options = options.map(o => o.option_text);
        }

        res.json({ quiz: quizzes });
    } catch (err) {
        console.error('Error mengambil quiz:', err);
        res.status(500).json({ error: 'Gagal mengambil soal quiz' });
    } finally {
        if (conn) conn.release();
    }
});



app.post('/api/quiz/result', async (req, res) => {
    console.log('--- /quiz/result endpoint hit ---');
    const userId = req.session.user ? req.session.user.id : null; 
    
    const { quizId, score, selectedOptions, correctAnswersCount, incorrectAnswersCount, totalQuestions } = req.body; 

    console.log('Received quiz result:', {
        userId,
        quizId,
        score,
        selectedOptions, 
        correctAnswersCount,
        incorrectAnswersCount,
        totalQuestions 
    });

  
    if (!userId || quizId === undefined || score === undefined || !Array.isArray(selectedOptions) || correctAnswersCount === undefined || incorrectAnswersCount === undefined || totalQuestions === undefined) { // Tambahkan totalQuestions ke validasi
        console.error('Data tidak lengkap untuk menyimpan hasil quiz.');
        return res.status(400).json({ message: 'Data tidak lengkap. userId (dari session), quizId, score, selectedOptions, correctAnswersCount, incorrectAnswersCount, dan totalQuestions diperlukan.' });
    }

   
    const selectedOptionJson = JSON.stringify(selectedOptions);
    const submissionDate = new Date();

    let conn;
    try {
        console.log('Attempting to get database connection...');
        conn = await pool.getConnection();
        console.log('Connection obtained, starting transaction...');

        await conn.beginTransaction();

        
        const insertResultQuery = `
            INSERT INTO user_quiz_results (user_id, quiz_id, score, selected_option, correct_answers_count, incorrect_answers_count, total_questions, submission_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        console.log('Executing insertResultQuery...');
      
        await conn.execute(insertResultQuery, [userId, quizId, score, selectedOptionJson, correctAnswersCount, incorrectAnswersCount, totalQuestions, submissionDate]);
        console.log('Quiz result saved to user_quiz_results.');

        const leaderboardUpdateQuery = `
            INSERT INTO leaderboard (user_id, total_points)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE total_points = total_points + VALUES(total_points)
        `;
        console.log('Executing leaderboardUpdateQuery...');
        await conn.execute(leaderboardUpdateQuery, [userId, score]); 
        console.log(`Leaderboard updated for user ${userId} with accumulated score: ${score}`);

        await conn.commit();
        console.log('Transaction committed successfully.');
        res.status(200).json({ message: 'Hasil quiz berhasil disimpan dan leaderboard diperbarui!' });

    } catch (error) {
        if (conn) {
            await conn.rollback();
            console.log('Transaction rolled back.');
        }
        console.error('Error FATAL saving quiz result or updating leaderboard:', error.message);
        console.error(error.stack);
        res.status(500).json({ message: 'Internal Server Error saat menyimpan hasil quiz atau memperbarui leaderboard.', error: error.message });
    } finally {
        if (conn) {
            conn.release();
            console.log('Database connection released.');
        }
    }
});

app.post('/api/quiz/save', isAuthenticated, async (req, res) => {
    console.log('--- /api/quiz/save endpoint hit ---');
    const { questions, level, total_questions, title, description, subject, duration_minutes } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0 || !level || !title || total_questions === undefined || total_questions === null) {
        console.error('Validasi data kuis gagal: Data tidak lengkap.');
        return res.status(400).json({ message: 'Data kuis tidak lengkap. Pastikan questions, level, title, dan total_questions terisi.' });
    }

    let conn; 
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        
        const [quizResult] = await conn.execute(
            `INSERT INTO quizzes (level, title, description, subject, total_questions, duration_minutes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [level, title, description, subject, total_questions, duration_minutes]
        );
        const newQuizId = quizResult.insertId;

       
        for (const question of questions) {
            const [questionResult] = await conn.execute(
                `INSERT INTO quiz_questions (quiz_id, question_text, correct_answer) VALUES (?, ?, ?)`,
                [newQuizId, question.question, question.correct_answer]
            );
            const newQuestionId = questionResult.insertId;

            
            if (question.options && Array.isArray(question.options)) {
                for (const optionText of question.options) {
                    await conn.execute(
                        `INSERT INTO quiz_options (question_id, option_text) VALUES (?, ?)`,
                        [newQuestionId, optionText]
                    );
                }
            }
        }

        await conn.commit();
        conn.release();

        res.status(201).json({
            message: 'Kuis berhasil disimpan!',
            quizId: newQuizId
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
            conn.release();
        }
        console.error('Error saving AI generated quiz to DB:', error);
        res.status(500).json({ message: 'Gagal menyimpan kuis yang dihasilkan AI.', error: error.message });
    }
});


app.get('/leaderboard', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [leaderboard] = await conn.execute(`
            SELECT u.username, l.total_points
            FROM users u
            JOIN leaderboard l ON u.id = l.user_id
            ORDER BY l.total_points DESC
            LIMIT 10;
        `);
        res.json({ leaderboard });
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).send('Gagal mengambil leaderboard');
    } finally {
        if (conn) conn.release();
    }
});



app.put('/profile/update-level', isAuthenticated, async (req, res) => {
    console.log('--- PUT /profile/update-level endpoint hit ---');
    const userId = req.session.user.id; 
    const { level } = req.body; 

    
    if (!level) {
        return res.status(400).json({ message: 'Level tidak boleh kosong.' });
    }

    
    const validLevels = ['pemula', 'menengah', 'mahir'];
    if (!validLevels.includes(level.toLowerCase())) { 
        return res.status(400).json({ message: 'Level tidak valid. Pilihan: pemula, menengah, mahir.' });
    }

    let conn; 
    try {
        conn = await pool.getConnection(); 

        
        const query = 'UPDATE users SET level = ? WHERE id = ?';
        const [results] = await conn.execute(query, [level.toLowerCase(), userId]); 

        
        if (results.affectedRows > 0) {
           
            req.session.user.level = level.toLowerCase();
            
            
            res.json({ message: 'Level berhasil diperbarui!', newLevel: level.toLowerCase() });
        } else {
            
            res.status(404).json({ message: 'Pengguna tidak ditemukan atau level tidak berubah.' });
        }
    } catch (err) {
        
        console.error('Error updating user level:', err);
        res.status(500).json({ message: 'Gagal menyimpan level pengguna.', error: err.message });
    } finally {
        
        if (conn) conn.release();
    }
});

app.put('/profile/update-username', isAuthenticated, async (req, res) => {
    console.log('--- PUT /profile/update-username endpoint hit ---');
    const userId = req.session.user.id;
    const { username } = req.body; 

  
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return res.status(400).json({ message: 'Username tidak boleh kosong dan harus berupa teks.' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        
        const [existingUsers] = await conn.execute('SELECT id FROM users WHERE username = ? AND id != ?', [username.trim(), userId]);
        if (existingUsers.length > 0) {
            conn.release();
            return res.status(409).json({ message: 'Username ini sudah digunakan oleh pengguna lain.' });
        }

        const query = 'UPDATE users SET username = ? WHERE id = ?'; 
        const [results] = await conn.execute(query, [username.trim(), userId]);

        if (results.affectedRows > 0) {
           
            req.session.user.username = username.trim();
            res.json({ message: 'Username berhasil diperbarui!', newUsername: username.trim() });
        } else {
            res.status(404).json({ message: 'Pengguna tidak ditemukan atau username tidak berubah.' });
        }
    } catch (err) {
        console.error('Error updating username:', err);
        res.status(500).json({ message: 'Gagal menyimpan username pengguna.', error: err.message });
    } finally {
        if (conn) conn.release();
    }
});


app.get('/profile', isAuthenticated, async (req, res) => {
    console.log('--- /profile endpoint hit ---');
    const userId = req.session.user.id;
    let conn;
    try {
        conn = await pool.getConnection(); 
        const [rows] = await conn.execute( 
            'SELECT username, level FROM users WHERE id = ?',
            [userId]
        );
        conn.release();

        if (rows.length > 0) {
            res.status(200).json(rows[0]); 
        } else {
            res.status(404).json({ message: 'Profil pengguna tidak ditemukan.' });
        }
    } catch (error) {
        console.error('Error fetching basic profile:', error);
        res.status(500).json({ message: 'Gagal memuat data profil dasar.' });
    } finally {
        if (conn) conn.release();
    }
});

app.get('/test', (req, res) => {
    res.send('Test route works!');
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


app.use(express.static(path.join(__dirname, 'public')));


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});