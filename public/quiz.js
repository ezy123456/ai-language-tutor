let currentQuizData = []; 
let userSelections = []; 
let quizGeneratedId = null; 


const quizLengthSelect = document.getElementById('quiz-length');
const quizLevelSelect = document.getElementById('quiz-level');
const startQuizBtn = document.getElementById('start-quiz-btn');
const quizContainer = document.getElementById('quiz-container');
const submitBtn = document.getElementById('submit-btn');
const restartQuizBtn = document.getElementById('restart-quiz-btn');
const scoreSpan = document.getElementById('score');
const scoreMessageDiv = document.getElementById('score-message');
const leaderboardTbody = document.querySelector('#leaderboard tbody');
const logoutBtn = document.getElementById('logout-btn');
const errorMessageDiv = document.getElementById('error-message'); 


function displayError(message) {
    if (errorMessageDiv) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.color = 'red';
        errorMessageDiv.style.fontWeight = 'bold';
        errorMessageDiv.style.display = 'block'; 
    } else {
     
        Swal.fire({
            icon: 'error',
            title: 'Terjadi Kesalahan!',
            text: message,
            confirmButtonText: 'Oke',
            confirmButtonColor: '#dc3545'
        });
    }
}


function renderQuiz(quizData) {
    quizContainer.innerHTML = ''; 
    errorMessageDiv.textContent = '';
    errorMessageDiv.style.display = 'none';

    if (!Array.isArray(quizData) || quizData.length === 0) {
        quizContainer.innerHTML = '<p class="text-muted">Tidak ada soal quiz yang dihasilkan. Coba lagi atau sesuaikan pilihan Anda.</p>';
        submitBtn.disabled = true; 
        submitBtn.style.display = 'none';
        return;
    }

    quizData.forEach((item, idx) => {
        const questionDiv = document.createElement('div');
        questionDiv.classList.add('question-item', 'mb-3', 'p-3', 'border', 'rounded');
        questionDiv.setAttribute('data-question-id', item.id || `q-${idx}`); 

        if (!Array.isArray(item.options) || item.options.length === 0 || item.options.some(opt => typeof opt !== 'string' || opt.trim() === '')) {
            console.warn(`Soal ${idx + 1} tidak memiliki opsi valid atau kosong:`, item);
            questionDiv.innerHTML = `
                <p><strong>${idx + 1}. ${item.question || 'Pertanyaan tidak valid'}</strong></p>
                <p class="text-danger">Pilihan jawaban tidak valid untuk soal ini.</p>
            `;
            quizContainer.appendChild(questionDiv);
            return;
        }

        const optionsHtml = item.options.map((option, optionIdx) => {
            const inputId = `q${idx}-option-${optionIdx}-${Date.now()}`; 
            return `
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="q${idx}" id="${inputId}" value="${option}">
                    <label class="form-check-label" for="${inputId}" style="flex-grow: 1;">
                        ${option}
                    </label>
                </div>
            `;
        }).join('');

        questionDiv.innerHTML = `
            <p class="question-text"><strong>${idx + 1}. ${item.question}</strong></p>
            <div class="options-group">${optionsHtml}</div>
        `;

        quizContainer.appendChild(questionDiv);

       
        const inputs = questionDiv.querySelectorAll(`input[name="q${idx}"]`);
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                userSelections[idx] = { 
                    question: item.question, 
                    question_id: item.id || `q-${idx}`, 
                    selected_option: input.value,
                    correct_option: item.correct_answer 
                };
            });
        });
    });
    submitBtn.disabled = false; 
    submitBtn.style.display = 'block';
    restartQuizBtn.style.display = 'none';
}

async function loadQuizFromUI() {
    const numQuestions = parseInt(quizLengthSelect.value, 10);
    const quizLevel = quizLevelSelect.value;
    
  
    currentQuizData = [];
    userSelections = Array(numQuestions).fill(null); 
    quizGeneratedId = null; 
    scoreSpan.textContent = '0';
    scoreMessageDiv.innerHTML = '';
    quizContainer.innerHTML = '<p class="text-muted text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Memuat...</span></div> Memuat soal-soal quiz...</p>'; // Indikator loading dengan spinner
    submitBtn.style.display = 'none';
    submitBtn.disabled = true;
    restartQuizBtn.style.display = 'none'; 
    displayError(''); 

    await loadQuiz(numQuestions, quizLevel); 
}

async function loadQuiz(numQuestions, quizLevel) {
    try {
        const promptResponse = await fetch('/api/get-prompt?promptName=generasi_kuis_base');
        if (!promptResponse.ok) {
            throw new Error(`Gagal mengambil prompt kuis dari database (Status: ${promptResponse.status}).`);
        }
        const promptData = await promptResponse.json();
        let prompt = promptData.teks_prompt;

        prompt = prompt.replace('[NUM_QUESTIONS]', numQuestions).replace(/\[QUIZ_LEVEL\]/g, quizLevel);
       

        const res = await fetch('/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }),
        });

        if (!res.ok) {
            const errorDetails = await res.text();
            throw new Error(`Gagal mengambil konten dari AI (Status: ${res.status}): ${errorDetails}`);
        }

        const data = await res.json(); 

        let quizDataFromAI;

        console.log("Tipe data.generatedContent:", typeof data.generatedContent);
        console.log("Isi data.generatedContent:", data.generatedContent);

        if (typeof data.generatedContent === 'string') {
            try {
                
                const cleanJsonString = data.generatedContent.replace(/^```json\s*|```\s*$/g, '').trim();
                quizDataFromAI = JSON.parse(cleanJsonString);
            } catch (parseError) {
                console.error("Gagal mem-parse JSON dari AI (string konten):", parseError);
                console.error("Konten AI mentah (string, gagal parse):", data.generatedContent);
                throw new Error("AI mengembalikan konten tidak valid (bukan JSON yang dapat diparse).");
            }
        } else if (Array.isArray(data.generatedContent)) { 
            quizDataFromAI = data.generatedContent;
        } else {
            console.error("Konten AI tidak dalam format yang diharapkan (bukan string JSON atau array):", data.generatedContent);
            throw new Error("AI tidak mengembalikan konten yang dapat digunakan.");
        }

        
        if (!Array.isArray(quizDataFromAI) || quizDataFromAI.length === 0) {
            console.error("Konten AI yang diparse bukan array valid atau kosong:", quizDataFromAI);
            throw new Error("AI tidak mengembalikan format soal yang valid atau kosong.");
        }
        
       
        quizDataFromAI = quizDataFromAI.map((q, index) => {
            
            if (!q.question || !Array.isArray(q.options) || q.options.length === 0 || !q.correct_answer) {
                console.warn(`Soal ke-${index + 1} dari AI tidak valid, melewatkan:`, q);
                return null; 
            }
            return {
                ...q,
                id: q.id || `ai_q_${index}_${Date.now()}` 
            };
        }).filter(q => q !== null); 

        if (quizDataFromAI.length === 0) {
            throw new Error("Tidak ada soal valid yang dihasilkan oleh AI setelah pemrosesan.");
        }

        
        const quizSaveResponse = await fetch('/api/quiz/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questions: quizDataFromAI,
                level: quizLevel,
                total_questions: quizDataFromAI.length, 
                title: `Kuis Bahasa Prancis - ${quizLevel} (${quizDataFromAI.length} soal)`,
                description: `Kuis ${quizDataFromAI.length} soal level ${quizLevel} yang dihasilkan AI.`,
                subject: 'Prancis',
                duration_minutes: 10
            })
        });

        if (!quizSaveResponse.ok) {
            const errorSaveDetails = await quizSaveResponse.json();
            throw new Error(`Gagal menyimpan kuis ke database: ${errorSaveDetails.message || 'Unknown error'}`);
        }

        const quizSaveResult = await quizSaveResponse.json();
        quizGeneratedId = quizSaveResult.quizId; 

        currentQuizData = quizDataFromAI; 
        renderQuiz(currentQuizData);
        userSelections = Array(currentQuizData.length).fill(null); 
        submitBtn.disabled = false;
        submitBtn.style.display = 'block';

    } catch (error) {
        console.error("Error loading quiz:", error);
        quizContainer.innerHTML = `<p class="text-danger text-center">Gagal memuat quiz: ${error.message}. Silakan coba lagi.</p>`;
        displayError(`Error: Gagal memuat quiz. ${error.message}.`);
        submitBtn.disabled = true;
        submitBtn.style.display = 'none';
        restartQuizBtn.style.display = 'none';
    }
}


submitBtn.addEventListener('click', async () => {
    const allAnswered = userSelections.every(selection => selection !== null);
    if (!allAnswered) {
        Swal.fire({
            icon: 'warning',
            title: 'Soal Belum Lengkap!',
            text: 'Harap jawab semua soal sebelum submit!',
            confirmButtonText: 'Oke',
            confirmButtonColor: '#ffc107'
        });
        return;
    }

    let calculatedScore = 0;
    let correctAnswersCount = 0;
    let incorrectAnswersCount = 0;
    const finalSelectedOptions = []; 

    currentQuizData.forEach((question, index) => {
        const userSelection = userSelections[index];
        const questionDiv = document.querySelector(`.question-item[data-question-id="${question.id}"]`);
        
        if (questionDiv) {
            questionDiv.classList.remove('correct', 'incorrect', 'unanswered');
        }

        const radioInputs = questionDiv.querySelectorAll('input[type="radio"]');
        radioInputs.forEach(input => input.disabled = true);

        if (userSelection && userSelection.selected_option === question.correct_answer) {
            calculatedScore += 1; 
            correctAnswersCount++;
            if (questionDiv) {
                questionDiv.classList.add('correct');
                const correctOptionInput = questionDiv.querySelector(`input[value="${question.correct_answer}"]`);
                if (correctOptionInput && correctOptionInput.parentElement) {
                    correctOptionInput.parentElement.classList.add('text-success', 'fw-bold');
                }
            }
            scoreMessageDiv.innerHTML += `<p>Soal ${index + 1}: <span class="text-success">Benar!</span> (Jawaban: ${question.correct_answer})</p>`;
        } else {
            incorrectAnswersCount++;
            if (questionDiv) {
                questionDiv.classList.add('incorrect');
                if (userSelection && userSelection.selected_option) {
                    const selectedOptionInput = questionDiv.querySelector(`input[value="${userSelection.selected_option}"]`);
                    if (selectedOptionInput && selectedOptionInput.parentElement) {
                        selectedOptionInput.parentElement.classList.add('text-danger');
                    }
                }
                const correctOptionInput = questionDiv.querySelector(`input[value="${question.correct_answer}"]`);
                if (correctOptionInput && correctOptionInput.parentElement) {
                    correctOptionInput.parentElement.classList.add('text-success', 'fw-bold');
                }
            }
            scoreMessageDiv.innerHTML += `<p>Soal ${index + 1}: <span class="text-danger">Salah.</span> Jawaban benar: ${question.correct_answer}</p>`;
        }

        finalSelectedOptions.push({
            question_id: question.id, 
            selected_option: userSelection ? userSelection.selected_option : null, 
            correct_option: question.correct_answer 
        });
    });
    scoreSpan.textContent = calculatedScore; 
    
    
    submitBtn.style.display = 'none';
    restartQuizBtn.style.display = 'block';

    const userId = sessionStorage.getItem('userId');
    if (userId && quizGeneratedId) {
        console.log('Mengirim hasil kuis ke backend...');
        const submitSuccess = await submitQuizResults({
            userId: userId,
            quizId: quizGeneratedId, 
            score: calculatedScore,
            selectedOptions: finalSelectedOptions, 
            correctAnswersCount: correctAnswersCount,
            incorrectAnswersCount: incorrectAnswersCount,
            totalQuestions: currentQuizData.length 
        });
        
        if (submitSuccess) {
            Swal.fire({
                icon: 'success',
                title: 'Quiz Selesai!',
                text: `Skor Anda: ${calculatedScore} dari ${currentQuizData.length} soal.`,
                confirmButtonText: 'Oke',
                confirmButtonColor: '#28a745'
            }).then(() => {
                loadLeaderboard(); 
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menyimpan Skor!',
                text: 'Terjadi kesalahan saat menyimpan skor kuis ke database.',
                confirmButtonText: 'Oke',
                confirmButtonColor: '#dc3545'
            });
        }
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'Skor Tidak Tersimpan!',
            text: 'Anda perlu login dan kuis harus berhasil dimuat untuk menyimpan skor. Leaderboard akan tetap diperbarui jika tidak ada error lain.',
            confirmButtonText: 'Oke',
            confirmButtonColor: '#ffc107'
        }).then(() => {
            if (userId) {
                console.error("Quiz ID tidak tersedia. Skor tidak dapat disimpan ke database.");
            }
            loadLeaderboard(); 
        });
    }
});

async function submitQuizResults(resultData) { 
    console.log('Data yang akan dikirim untuk penyimpanan hasil quiz:', resultData);
    try {
        const response = await fetch('/api/quiz/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resultData),
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Hasil quiz berhasil disimpan di backend:', data.message);
            return true;
        } else {
            const errorData = await response.json();
            console.error('Gagal mengirimkan hasil quiz (server error):', errorData.message);
            return false;
        }
    } catch (error) {
        console.error('Gagal mengirimkan hasil quiz (kesalahan jaringan):', error);
        return false;
    }
}


async function loadLeaderboard() {
    leaderboardTbody.innerHTML = '<tr><td colspan="3" class="text-center"><div class="spinner-border text-secondary spinner-border-sm" role="status"><span class="visually-hidden">Memuat...</span></div> Memuat leaderboard...</td></tr>';
    try {
        const response = await fetch('/leaderboard');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        leaderboardTbody.innerHTML = ''; 

        if (data.leaderboard && data.leaderboard.length > 0) {
            data.leaderboard.forEach((entry, index) => {
                const row = leaderboardTbody.insertRow();
                const rankCell = row.insertCell();
                const usernameCell = row.insertCell();
                const scoreCell = row.insertCell();
                const quizLevelCell = row.insertCell(); 

                rankCell.textContent = index + 1;
                usernameCell.textContent = entry.username;
                scoreCell.textContent = entry.total_points;
                quizLevelCell.textContent = entry.quiz_level; 

                if (index === 0) row.classList.add('table-warning'); 
                else if (index === 1) row.classList.add('table-secondary'); 
                else if (index === 2) row.classList.add('table-danger'); 
            });
        } else {
            const row = leaderboardTbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4; 
            cell.textContent = 'Belum ada data leaderboard.';
            cell.classList.add('text-center', 'text-muted');
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboardTbody.innerHTML = '<tr><td colspan="4" class="text-danger text-center">Gagal memuat leaderboard.</td></tr>'; // Sesuaikan colspan
    }
}


logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        const response = await fetch('/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin' 
        });
        if (response.ok) {
            sessionStorage.removeItem('userId'); 
            sessionStorage.removeItem('username'); 
            sessionStorage.removeItem('userLevel'); 
            Swal.fire({
                icon: 'success',
                title: 'Logout Berhasil!',
                text: 'Anda telah berhasil logout.',
                showConfirmButton: false,
                timer: 1500,
                timerProgressBar: true
            }).then(() => {
                window.location.href = '/login.html';
            });
        } else {
            const errorData = await response.json();
            Swal.fire({
                icon: 'error',
                title: 'Logout Gagal!',
                text: errorData.message || 'Terjadi kesalahan saat logout.',
                confirmButtonText: 'Oke',
                confirmButtonColor: '#dc3545'
            });
        }
    } catch (error) {
        console.error('Error saat logout:', error);
        Swal.fire({
            icon: 'error',
            title: 'Koneksi Bermasalah!',
            text: 'Terjadi kesalahan jaringan saat logout.',
            confirmButtonText: 'Oke',
            confirmButtonColor: '#dc3545'
        });
    }
});


startQuizBtn.addEventListener('click', loadQuizFromUI);

restartQuizBtn.addEventListener('click', () => {
    scoreMessageDiv.innerHTML = ''; 
    scoreSpan.textContent = '0'; 
    userSelections = []; 
    restartQuizBtn.style.display = 'none'; 
    submitBtn.style.display = 'block'; 
    loadQuizFromUI(); 
});

document.addEventListener('DOMContentLoaded', () => {
    const userId = sessionStorage.getItem('userId');
    if (!userId) {
        Swal.fire({ 
            icon: 'info',
            title: 'Akses Dibatasi!',
            text: 'Anda harus login untuk mengakses halaman quiz.',
            confirmButtonText: 'Oke',
            confirmButtonColor: '#17a2b8' 
        }).then(() => {
            window.location.href = '/login.html'; 
        });
        return;
    }
    loadLeaderboard(); 
});