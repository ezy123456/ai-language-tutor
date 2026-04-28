const mysql = require('mysql2/promise'); 

const db = mysql.createPool({
    host: 'localhost', 
    user: 'root',      
    password: '',      
    database: 'ai_tutor', 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


db.getConnection()
    .then(connection => {
        console.log('Connected to MySQL database!');
        connection.release();
    })
    .catch(err => {
        console.error('Error connecting to MySQL:', err);
        process.exit(1); 
    });
module.exports = db;