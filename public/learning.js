window.onload = function () {
    const wordList = document.getElementById('word-list');
    const randomFactsList = document.getElementById('random-facts-list');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-message-btn');
    const chatContainer = document.getElementById('chatbot-response');
    const logoutBtn = document.getElementById('logout-btn');

 
    const fetchRandomFacts = async () => {
        try {
           
            const promptResponse = await fetch('/api/get-prompt?promptName=random_facts_prompt');
            if (!promptResponse.ok) {
                throw new Error(`Failed to fetch random facts prompt: ${promptResponse.statusText}`);
            }
            const promptData = await promptResponse.json();
            const prompt = promptData.teks_prompt; 
            

            const response = await fetch('/generate-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt })
            });
            const data = await response.json();

            randomFactsList.innerHTML = ''; 
            
            const htmlFormattedFacts = marked.parse(data.generatedContent);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlFormattedFacts; 

           
            const listItems = tempDiv.querySelectorAll('li, p'); 
            if (listItems.length > 0) {
                listItems.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = item.textContent.trim(); 
                    if (li.textContent) { 
                        randomFactsList.appendChild(li);
                    }
                });
            } else {
                
                const aiGeneratedFacts = data.generatedContent.split('\n');
                aiGeneratedFacts.forEach(fact => {
                    if (fact.trim() && fact.trim() !== '*') {
                        const cleanedFact = fact.replace(/^\d+\.\s*/, '').replace(/^-+\s*/, '');
                        const li = document.createElement('li');
                        li.textContent = cleanedFact.trim();
                        randomFactsList.appendChild(li);
                    }
                });
            }
            
        } catch (error) {
            console.error('Error generating random facts:', error);
            randomFactsList.innerHTML = '<li class="text-muted">Gagal memuat fakta.</li>';
        }
    };

    const fetchVocabulary = async () => {
        try {
            const response = await fetch('/learning', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin'
            });
            const data = await response.json();

            wordList.innerHTML = '';
            if (data.length === 0) {
                wordList.innerHTML = '<li class="text-muted">Tidak ada kata yang dipelajari untuk level ini.</li>';
            } else {
                data.forEach(word => {
                    const li = document.createElement('li');
                    li.dataset.wordId = word.id || 'no-id'; 
                    li.textContent = word.word;
                    li.classList.add('word-item');
                    li.addEventListener('click', () => openPopup(word));
                    wordList.appendChild(li);
                });
            }
        } catch (error) {
            console.error('Error fetching vocabulary:', error);
            wordList.innerHTML = '<li class="text-muted">Gagal memuat kosakata.</li>';
        }
    };


    const sendMessage = async () => {
        const message = userInput.value.trim();
        if (message === '') return;

        const userMessageDiv = document.createElement('div');
        userMessageDiv.classList.add('message', 'user-message');
        userMessageDiv.textContent = message;
        chatContainer.appendChild(userMessageDiv);

        userInput.value = '';
        chatContainer.scrollTop = chatContainer.scrollHeight;

        const loadingMessageDiv = document.createElement('div');
        loadingMessageDiv.classList.add('message', 'chatbot-message', 'loading-dots');
        loadingMessageDiv.innerHTML = '<span>.</span><span>.</span><span>.</span>';
        chatContainer.appendChild(loadingMessageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        try {
            const promptResponse = await fetch('/api/get-prompt?promptName=tutor_interaksi_base');
            if (!promptResponse.ok) {
                throw new Error(`Failed to fetch base prompt: ${promptResponse.statusText}`);
            }
            const promptData = await promptResponse.json();
            const basePrompt = promptData.teks_prompt;

            const fullPrompt = `${basePrompt}\n\nUser asks: ${message}`;

            const response = await fetch('/generate-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: fullPrompt })
            });
            const data = await response.json();

            chatContainer.removeChild(loadingMessageDiv);

            const chatbotMessageDiv = document.createElement('div');
            chatbotMessageDiv.classList.add('message', 'chatbot-message');
            
           
            chatbotMessageDiv.innerHTML = marked.parse(data.generatedContent);

            chatContainer.appendChild(chatbotMessageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        } catch (error) {
            console.error('Error sending message to chatbot:', error);
            chatContainer.removeChild(loadingMessageDiv);
            const errorMessageDiv = document.createElement('div');
            errorMessageDiv.classList.add('message', 'chatbot-message', 'error-message');
            errorMessageDiv.textContent = 'Maaf, ada masalah saat memproses permintaan Anda. Silakan coba lagi.';
            chatContainer.appendChild(errorMessageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    };


    const openPopup = async (word) => {
        const popup = document.getElementById('word-popup');
        document.getElementById('word-title').textContent = word.word + (word.level ? " (" + word.level + ")" : "");
        document.getElementById('word-meaning').textContent = word.meaning || 'Tidak ada arti';
        document.getElementById('word-usage').textContent = 'Memuat informasi penggunaan...';
        document.getElementById('word-example-list').innerHTML = '<li class="text-muted">Memuat contoh kalimat...</li>';

        popup.style.display = 'flex';

        try {
            
            const usagePromptResponse = await fetch('/api/get-prompt?promptName=word_usage_prompt');
            if (!usagePromptResponse.ok) {
                throw new Error(`Failed to fetch word usage prompt: ${usagePromptResponse.statusText}`);
            }
            const usagePromptData = await usagePromptResponse.json();
            const basePromptUsage = usagePromptData.teks_prompt;

            
            const examplePromptResponse = await fetch('/api/get-prompt?promptName=word_example_prompt');
            if (!examplePromptResponse.ok) {
                throw new Error(`Failed to fetch word example prompt: ${examplePromptResponse.statusText}`);
            }
            const examplePromptData = await examplePromptResponse.json();
            const basePromptExample = examplePromptData.teks_prompt;

            const promptUsage = basePromptUsage.replace('[WORD]', word.word);
            const promptExample = basePromptExample.replace('[WORD]', word.word);

            const [usageResponse, exampleResponse] = await Promise.all([
                fetch('/generate-content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: promptUsage })
                }),
                fetch('/generate-content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: promptExample })
                })
            ]);

            const usageData = await usageResponse.json();
            document.getElementById('word-usage').innerHTML = marked.parse(usageData.generatedContent || 'Tidak ada informasi kapan digunakan.');

            const exampleData = await exampleResponse.json();
            const htmlExamples = marked.parse(exampleData.generatedContent);
            const tempDivExamples = document.createElement('div');
            tempDivExamples.innerHTML = htmlExamples;
            
            document.getElementById('word-example-list').innerHTML = '';
            const exampleListItems = tempDivExamples.querySelectorAll('li, p'); 

            if (exampleListItems.length > 0) {
                exampleListItems.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = item.textContent.trim();
                    if (li.textContent) { 
                        document.getElementById('word-example-list').appendChild(li);
                    }
                });
            } else {
                
                const cleanExample = exampleData.generatedContent.replace(/\*+/g, '').replace(/^\d+\.\s*/gm, '').trim();
                if (cleanExample) {
                    const examples = cleanExample.split('\n').filter(line => line.trim() !== '');
                    examples.forEach(example => {
                        const li = document.createElement('li');
                        li.textContent = example.trim();
                        document.getElementById('word-example-list').appendChild(li);
                    });
                } else {
                    document.getElementById('word-example-list').innerHTML = '<li class="text-muted">Tidak ada contoh kalimat yang dihasilkan.</li>';
                }
            }
            

        } catch (error) {
            console.error('Error generating word details:', error);
            document.getElementById('word-usage').textContent = 'Error memuat informasi penggunaan.';
            document.getElementById('word-example-list').innerHTML = '<li class="text-muted">Error memuat contoh kalimat.</li>';
        }
    };


    document.getElementById('close-popup').addEventListener('click', function() {
        document.getElementById('word-popup').style.display = 'none';
    });

    sendButton.addEventListener('click', sendMessage);

    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

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

    
    fetchVocabulary();
    fetchRandomFacts();
};