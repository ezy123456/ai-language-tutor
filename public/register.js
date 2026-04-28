document.getElementById('registerForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const level = document.getElementById('level').value;

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, level })
        });

        const data = await response.text();

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Registrasi Berhasil!',
                text: 'Akun Anda berhasil dibuat. Silakan login.',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            }).then(() => {
                window.location.href = 'login.html'; 
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Registrasi Gagal!',
                text: data || 'Terjadi kesalahan saat registrasi. Silakan coba lagi.',
                confirmButtonText: 'Coba Lagi',
                confirmButtonColor: '#dc3545'
            });
        }
    } catch (error) {
        console.error('Error saat melakukan fetch registrasi:', error);
        Swal.fire({
            icon: 'warning',
            title: 'Koneksi Bermasalah!',
            text: 'Terjadi kesalahan jaringan atau server tidak merespons. Silakan coba beberapa saat lagi.',
            confirmButtonText: 'Oke',
            confirmButtonColor: '#ffc107'
        });
    }
});
