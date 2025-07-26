const API_URL = 'http://localhost:5005/process_sync';

const questionInput = document.getElementById('questionInput');
const submitBtn = document.getElementById('submitBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const responseText = document.getElementById('responseText');
const imageDisplay = document.getElementById('imageDisplay');

submitBtn.addEventListener('click', submitQuestion);
questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        submitQuestion();
    }
});

async function submitQuestion() {
    const question = questionInput.value.trim();
    
    if (!question) {
        alert('Please enter a question');
        return;
    }

    // Show loading indicator
    loadingIndicator.classList.remove('hidden');
    submitBtn.disabled = true;
    
    // Clear previous results
    responseText.textContent = '';
    imageDisplay.innerHTML = '';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Display the response text as markdown
        const markdownContent = data.response || 'No response received';
        responseText.innerHTML = marked.parse(markdownContent);
        
        // Extract and display any image URLs from the response
        const imageUrls = extractImageUrls(data.response);
        displayImages(imageUrls);
        
    } catch (error) {
        console.error('Error:', error);
        responseText.textContent = `Error: ${error.message}\n\nMake sure the Python server is running on port 5005.`;
    } finally {
        // Hide loading indicator
        loadingIndicator.classList.add('hidden');
        submitBtn.disabled = false;
    }
}

function extractImageUrls(text) {
    if (!text) return [];
    
    // Look for URLs in the response text
    // This regex looks for URLs that might be image URLs (ending with image extensions or from known image services)
    const urlRegex = /(https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp|pollinations\.ai\/[^\s]+))/gi;
    const matches = text.match(urlRegex) || [];
    
    // Also check for patterns like "image created successfully: URL"
    const imageCreatedRegex = /image created successfully:\s*(https?:\/\/[^\s]+)/gi;
    let match;
    while ((match = imageCreatedRegex.exec(text)) !== null) {
        if (!matches.includes(match[1])) {
            matches.push(match[1]);
        }
    }
    
    return matches;
}

function displayImages(imageUrls) {
    imageDisplay.innerHTML = '';
    
    if (imageUrls.length === 0) {
        return;
    }
    
    imageUrls.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Generated image';
        img.onerror = function() {
            this.style.display = 'none';
            console.error('Failed to load image:', url);
        };
        imageDisplay.appendChild(img);
    });
}