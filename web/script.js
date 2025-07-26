const API_URL = 'http://gabdsg.local:5005/process_sync';

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
        
        // Extract and embed Spotify links
        const spotifyLinks = extractSpotifyLinks(data.response);
        embedSpotifyPlayers(spotifyLinks);
        
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

function extractSpotifyLinks(text) {
    if (!text) return [];
    
    // Match Spotify URLs (tracks, albums, playlists, etc.)
    const spotifyRegex = /https?:\/\/open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)(?:\?[^\s]*)?/gi;
    const matches = [];
    let match;
    
    while ((match = spotifyRegex.exec(text)) !== null) {
        matches.push({
            url: match[0],
            type: match[1],
            id: match[2]
        });
    }
    
    return matches;
}

function embedSpotifyPlayers(spotifyLinks) {
    if (spotifyLinks.length === 0) return;
    
    // Get the image display container
    const imageDisplay = document.getElementById('imageDisplay');
    
    // Create a container for Spotify players
    const playersContainer = document.createElement('div');
    playersContainer.className = 'spotify-players-container';
    
    spotifyLinks.forEach(link => {
        const iframe = document.createElement('iframe');
        
        // Determine embed height based on type
        let height = '152'; // Default for track
        if (link.type === 'album' || link.type === 'playlist') {
            height = '352';
        } else if (link.type === 'artist') {
            height = '352';
        }
        
        iframe.src = `https://open.spotify.com/embed/${link.type}/${link.id}?utm_source=generator&theme=0`;
        iframe.width = '100%';
        iframe.height = height;
        iframe.style.border = 'none';
        iframe.allowfullscreen = true;
        iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        iframe.loading = 'lazy';
        iframe.className = 'spotify-embed';
        
        playersContainer.appendChild(iframe);
    });
    
    // Insert Spotify players at the beginning of imageDisplay
    imageDisplay.insertBefore(playersContainer, imageDisplay.firstChild);
}