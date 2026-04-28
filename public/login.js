document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            const receivedUsername = data.user.username; 

            sessionStorage.setItem('userId', data.user.id);
            sessionStorage.setItem('username', receivedUsername); 
            sessionStorage.setItem('userLevel', data.user.level); 

        
            Swal.fire({
                icon: 'success',
                title: 'Login Berhasil!',
                html: `Selamat datang, <strong>${receivedUsername || 'Pengguna'}</strong>.`, 
                showConfirmButton: false, 
                timer: 2000, 
                timerProgressBar: true 
            }).then(() => {
                
                window.location.href = '/learning.html'; 
            });
            
        } else {
            
            Swal.fire({
                icon: 'error',
                title: 'Login Gagal!',
                text: data.message || 'Username atau password salah. Silakan coba lagi.',
                confirmButtonText: 'Coba Lagi',
                confirmButtonColor: '#dc3545' 
            });
        }
    } catch (error) {
        console.error('Error saat melakukan fetch login:', error);
        
        Swal.fire({
            icon: 'warning', 
            title: 'Koneksi Bermasalah!',
            text: 'Terjadi kesalahan jaringan atau server tidak merespons. Silakan coba beberapa saat lagi.',
            confirmButtonText: 'Oke',
            confirmButtonColor: '#ffc107' 
        });
    }
});