document.addEventListener('DOMContentLoaded', async () => {
    
    const userId = sessionStorage.getItem('userId');
    
    if (!userId) {
        Swal.fire({ 
            icon: 'info',
            title: 'Akses Dibatasi!',
            text: 'Anda harus login untuk mengakses halaman profil.',
            confirmButtonText: 'Oke',
            confirmButtonColor: '#17a2b8' 
        }).then(() => {
            window.location.href = '/login.html';
        });
        return;
    }

    const profileUsernameElement = document.getElementById('profile-username');
    const profileLevelElement = document.getElementById('profile-level');
    const levelSelect = document.getElementById('level-select');
    const saveLevelBtn = document.getElementById('save-level-btn');

    const usernameInputElement = document.getElementById('username-input');
    const saveUsernameBtn = document.getElementById('save-username-btn');
    

    let initialUsername = sessionStorage.getItem('username');
    
   
    if (profileUsernameElement) {
        profileUsernameElement.textContent = initialUsername || 'Memuat...';
    }
    
    
    if (usernameInputElement) {
        usernameInputElement.value = initialUsername || '';
    }
    
    
    let currentUsername = initialUsername || 'Pengguna'; 
  
    let currentUserLevel = sessionStorage.getItem('userLevel');
    if (profileLevelElement) {
        profileLevelElement.textContent = (currentUserLevel || 'pemula').charAt(0).toUpperCase() + (currentUserLevel || 'pemula').slice(1);
    }
    if (levelSelect) {
        levelSelect.value = currentUserLevel || 'pemula';
    }


   
    async function loadUserProfileData() {
        console.log('Memuat data profil lengkap dari backend...');
        try {
            const response = await fetch(`/profile`); 
            if (response.ok) {
                const data = await response.json();
                console.log('Data profil diterima:', data);

                
                if (profileUsernameElement) {
                    profileUsernameElement.textContent = data.username || 'Pengguna';
                    currentUsername = data.username || 'Pengguna';
                    if (usernameInputElement) {
                        usernameInputElement.value = data.username || '';
                    }
                    sessionStorage.setItem('username', data.username || 'Pengguna');
                }

                
                if (profileLevelElement) {
                    profileLevelElement.textContent = (data.level || 'pemula').charAt(0).toUpperCase() + (data.level || 'pemula').slice(1);
                    currentUserLevel = data.level || 'pemula'; 
                    if (levelSelect) {
                        levelSelect.value = data.level || 'pemula';
                    }
                    sessionStorage.setItem('userLevel', data.level || 'pemula');
                }
            } else {
                const errorData = await response.json();
                console.error('Gagal memuat data profil dasar:', errorData.message);
                if (profileUsernameElement) profileUsernameElement.textContent = 'Gagal memuat';
                if (profileLevelElement) profileLevelElement.textContent = 'Gagal memuat';
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal Memuat Profil!',
                    text: 'Gagal memuat data profil: ' + errorData.message,
                    confirmButtonText: 'Oke',
                    confirmButtonColor: '#dc3545'
                });
            }
        } catch (error) {
            console.error('Error fetching basic profile data:', error);
            if (profileUsernameElement) profileUsernameElement.textContent = 'Tidak diketahui';
            if (profileLevelElement) profileLevelElement.textContent = 'Tidak diketahui';
            Swal.fire({ 
                icon: 'error',
                title: 'Koneksi Bermasalah!',
                text: 'Terjadi kesalahan jaringan saat memuat profil.',
                confirmButtonText: 'Oke',
                confirmButtonColor: '#dc3545'
            });
        }
    }

    await loadUserProfileData();



    if (saveLevelBtn) {
        saveLevelBtn.addEventListener('click', async () => {
            const newLevel = levelSelect.value;
            
            const currentLevelDisplayedText = profileLevelElement.textContent.trim().toLowerCase(); 

            
            if (newLevel === currentLevelDisplayedText) {
                Swal.fire({ 
                    icon: 'info',
                    title: 'Tidak Ada Perubahan',
                    text: `Level Anda sudah diatur ke ${newLevel.charAt(0).toUpperCase() + newLevel.slice(1)}. Tidak ada perubahan yang disimpan.`,
                    confirmButtonText: 'Oke',
                    confirmButtonColor: '#17a2b8'
                });
                return;
            }

            try {
                const response = await fetch(`/profile/update-level`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ level: newLevel })
                });

                if (response.ok) {
                    const result = await response.json();
                    profileLevelElement.textContent = newLevel.charAt(0).toUpperCase() + newLevel.slice(1);
                    sessionStorage.setItem('userLevel', newLevel); 
                    currentUserLevel = newLevel; 
                    Swal.fire({ 
                        icon: 'success',
                        title: 'Level Berhasil Diperbarui!',
                        text: `Level berhasil diperbarui menjadi: ${newLevel.charAt(0).toUpperCase() + newLevel.slice(1)}`,
                        showConfirmButton: false, 
                        timer: 1500, 
                        timerProgressBar: true
                    });
                    console.log('Level berhasil diperbarui:', result);
                } else {
                    const errorData = await response.json();
                    throw new Error(`Gagal memperbarui level: ${errorData.message}`);
                }
            } catch (error) {
                console.error('Error saat memperbarui level:', error);
                Swal.fire({ 
                    icon: 'error',
                    title: 'Gagal Memperbarui Level!',
                    text: 'Terjadi kesalahan saat memperbarui level: ' + error.message,
                    confirmButtonText: 'Oke',
                    confirmButtonColor: '#dc3545'
                });
                
                if (levelSelect) {
                    levelSelect.value = currentUserLevel; 
                }
            }
        });
    }

    
    if (saveUsernameBtn) {
        saveUsernameBtn.addEventListener('click', async () => {
            const newUsername = usernameInputElement.value.trim();
            if (!newUsername) {
                Swal.fire({ 
                    icon: 'warning',
                    title: 'Input Kosong!',
                    text: 'Username tidak boleh kosong.',
                    confirmButtonText: 'Oke',
                    confirmButtonColor: '#ffc107'
                });
                return;
            }
            if (newUsername === currentUsername) {
                Swal.fire({
                    icon: 'info',
                    title: 'Tidak Ada Perubahan',
                    text: `Username Anda sudah diatur ke "${newUsername}". Tidak ada perubahan yang disimpan.`,
                    confirmButtonText: 'Oke',
                    confirmButtonColor: '#17a2b8'
                });
                return;
            }

            try {
                const response = await fetch(`/profile/update-username`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username: newUsername })
                });

                if (response.ok) {
                    const result = await response.json();
                    profileUsernameElement.textContent = newUsername;
                    sessionStorage.setItem('username', newUsername);
                    currentUsername = newUsername;
                    Swal.fire({ 
                        icon: 'success',
                        title: 'Username Berhasil Diperbarui!',
                        text: `Username berhasil diperbarui menjadi: ${newUsername}`,
                        showConfirmButton: false,
                        timer: 1500, 
                        timerProgressBar: true
                    });
                    console.log('Username berhasil diperbarui:', result);
                } else {
                    const errorData = await response.json();
                    throw new Error(`Gagal memperbarui username: ${errorData.message}`);
                }
            } catch (error) {
                console.error('Error saat memperbarui username:', error);
                Swal.fire({ 
                    icon: 'error',
                    title: 'Gagal Memperbarui Username!',
                    text: 'Terjadi kesalahan saat memperbarui username: ' + error.message,
                    confirmButtonText: 'Oke',
                    confirmButtonColor: '#dc3545'
                });
                if (usernameInputElement) {
                    usernameInputElement.value = currentUsername;
                }
            }
        });
    }


   
    await Promise.all([
        loadScoreHistory(),
        loadQuizStats(),
        loadLearningProgress(),
        loadRewards()
    ]).catch(err => {
        console.error("Setidaknya satu fungsi pemuatan profil gagal:", err);
    });
});


async function loadScoreHistory() {
    console.log('Memuat riwayat skor...');
    const userId = sessionStorage.getItem('userId');
    const chartCanvas = document.getElementById('perkembangan-skor-chart');
    const noHistoryMessage = document.getElementById('no-score-history-message');
    const chartContainer = document.getElementById('score-chart-container');

    try {
        const response = await fetch(`/profile/score-history`);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Respons error riwayat skor:', errorData.message);
            throw new Error(`Gagal memuat riwayat skor: ${errorData.message}`);
        }
        const data = await response.json();
        console.log('Data riwayat skor diterima:', data);

        if (chartCanvas && noHistoryMessage) {
            const existingChart = Chart.getChart(chartCanvas);
            if (existingChart) {
                existingChart.destroy();
            }

            if (data.dates && data.scores && data.dates.length > 0) {
                renderScoreChart(data.dates, data.scores);
                chartCanvas.style.display = 'block';
                noHistoryMessage.style.display = 'none';
            } else {
                chartCanvas.style.display = 'none';
                noHistoryMessage.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading score history:', error);
        if (chartContainer) {
            chartContainer.innerHTML = '<p class="text-danger text-center">Gagal memuat riwayat skor. Silakan coba lagi nanti.</p>';
        }
    }
}

/**
 * 
 * @param {Array<string>} dates 
 * @param {Array<number>} scores 
 */

function renderScoreChart(dates, scores) {
    const ctx = document.getElementById('perkembangan-skor-chart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Skor Kuis',
                data: scores,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.2)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Perkembangan Skor Kuis',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Skor: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Tanggal'
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 10
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Skor'
                    },
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}


async function loadQuizStats() {
    console.log('Memuat statistik kuis...');
    const userId = sessionStorage.getItem('userId');
    try {
        const response = await fetch(`/profile/quiz-stats`);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Respons error statistik kuis:', errorData.message);
            throw new Error(`Gagal memuat statistik kuis: ${errorData.message}`);
        }
        const data = await response.json();
        console.log('Data statistik kuis diterima:', data);

        document.getElementById('total-quiz-dikerjakan').textContent = data.total_quizzes !== null ? data.total_quizzes : '0';
        document.getElementById('skor-kuis-terbaik').textContent = data.best_score !== null ? data.best_score : 'N/A';
        document.getElementById('skor-kuis-terendah').textContent = data.lowest_score !== null ? data.lowest_score : 'N/A';
        document.getElementById('skor-rata-rata').textContent = data.average_score !== null ? `${parseFloat(data.average_score).toFixed(2)}` : 'N/A';
        document.getElementById('total-jawaban-benar').textContent = data.total_correct_answers !== null ? data.total_correct_answers : '0';
        document.getElementById('total-jawaban-salah').textContent = data.total_incorrect_answers !== null ? data.total_incorrect_answers : '0';
        document.getElementById('persentase-streak-quiz').textContent = data.quiz_streak_percentage !== null ? `${data.quiz_streak_percentage}%` : 'N/A';

    } catch (error) {
        console.error('Error loading quiz stats:', error);
        const statElements = ['total-quiz-dikerjakan', 'skor-kuis-terbaik', 'skor-kuis-terendah', 'skor-rata-rata', 'total-jawaban-benar', 'total-jawaban-salah', 'persentase-streak-quiz'];
        statElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'Error!';
        });
    }
}


async function loadLearningProgress() {
    console.log('Memuat progres pembelajaran...');
    const userId = sessionStorage.getItem('userId');
    const learningProgressDiv = document.getElementById('progres-pembelajaran-per-level');
    try {
        const response = await fetch(`/profile/learning-progress`);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Respons error progres pembelajaran:', errorData.message);
            throw new Error(`Gagal memuat progres pembelajaran: ${errorData.message}`);
        }
        const data = await response.json();
        console.log('Data progres pembelajaran diterima:', data);

        if (learningProgressDiv) {
            let progressHtml = '<h4>Progres Pembelajaran per Level:</h4><ul class="list-group">';
            if (data.learning_progress_by_level && Object.keys(data.learning_progress_by_level).length > 0) {
                const levelsOrder = ['pemula', 'menengah', 'mahir'];
                levelsOrder.forEach(level => {
                    const score = data.learning_progress_by_level[level];
                    if (score !== undefined && score !== null) {
                        progressHtml += `
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Level ${level.charAt(0).toUpperCase() + level.slice(1)}
                                <span class="badge bg-primary rounded-pill">Rata-rata Skor: ${score.toFixed(2)}</span>
                            </li>
                        `;
                    }
                });
            } else {
                progressHtml += '<li class="list-group-item text-muted">Belum ada data progres pembelajaran.</li>';
            }
            progressHtml += '</ul>';
            learningProgressDiv.innerHTML = progressHtml;
        }

    } catch (error) {
        console.error('Error loading learning progress:', error);
        if (learningProgressDiv) {
            learningProgressDiv.innerHTML = '<p class="text-danger">Gagal memuat progres pembelajaran.</p>';
        }
    }
}

async function loadRewards() {
    console.log('Memuat pencapaian...');
    const userId = sessionStorage.getItem('userId');
    const rewardsContainer = document.getElementById('rewards-container');

    try {
        const response = await fetch(`/profile/rewards`);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Respons error pencapaian:', errorData.message);
            throw new Error(`Gagal memuat pencapaian: ${errorData.message}`);
        }
        const data = await response.json();
        console.log('Data pencapaian diterima:', data);

        if (rewardsContainer) {
            rewardsContainer.innerHTML = ''; 

            if (data.length > 0) {
                data.forEach(reward => {
                    const statusClass = reward.achieved ? 'achieved' : 'locked';
                    const tagContent = reward.achieved ? 'Tercapai!' : 'Terkunci';
                    const iconHtml = reward.icon_url 
                        ? `<img src="${reward.icon_url}" alt="${reward.name}" class="reward-icon mb-2">`
                        : `<i class="bi ${reward.icon_class || 'bi-award-fill'} text-warning mb-2" style="font-size: 3rem;"></i>`;

                    rewardsContainer.innerHTML += `
                        <div class="col-md-4 col-sm-6 mb-4 reward-item ${statusClass}">
                            ${iconHtml}
                            <h4>${reward.name}</h4>
                            <p>${reward.description}</p>
                            <span class="${statusClass}-tag">${tagContent}</span>
                        </div>
                    `;
                });
            } else {
                rewardsContainer.innerHTML = '<div class="col-12"><p class="text-muted text-center">Belum ada pencapaian yang diraih.</p></div>';
            }
        }
    } catch (error) {
        console.error('Error loading rewards:', error);
        if (rewardsContainer) {
            rewardsContainer.innerHTML = '<div class="col-12"><p class="text-danger text-center">Gagal memuat daftar pencapaian. Silakan coba lagi nanti.</p></div>';
        }
    }
}
