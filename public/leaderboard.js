async function loadLeaderboard() {
    try {
        const response = await fetch('/leaderboard'); 
        const data = await response.json();
        console.log("Data yang diterima dari server:", data); 

        const leaderboardTable = document.getElementById('leaderboard').querySelector('tbody');
        leaderboardTable.innerHTML = ''; 

        if (data.leaderboard && Array.isArray(data.leaderboard)) {
            data.leaderboard.forEach((user, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td> <td>${user.username}</td>
                    <td>${user.total_points}</td>
                `;
                leaderboardTable.appendChild(row);
            });
        } else {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="3">Belum ada data leaderboard.</td>`;
            leaderboardTable.appendChild(row);
        }

    } catch (error) {
        console.error('Error loading leaderboard:', error);
        const leaderboardTable = document.getElementById('leaderboard').querySelector('tbody');
        leaderboardTable.innerHTML = `<tr><td colspan="3">Gagal memuat leaderboard.</td></tr>`; 
    }
}