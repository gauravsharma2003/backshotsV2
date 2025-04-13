const express = require('express');
const app = express();
const port = 3000;
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Disable SSL certificate verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Configure ytdl-core to use custom agent
const agent = new https.Agent({
    rejectUnauthorized: false
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Helper function to get video info with retry
async function getVideoInfoWithRetry(videoId, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const info = await ytdl.getInfo(videoId, { 
                requestOptions: { agent },
                lang: 'en'
            });
            return info;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error.message);
            if (i === maxRetries - 1) {
                if (error.message.includes('410')) {
                    throw new Error('Video is no longer available');
                }
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

app.get('/', (req, res) => {
    res.send('YouTube Music Streamer/Downloader');
});

// Stream music
app.get('/stream/:videoId', async (req, res) => {
    try {
        const videoId = req.params.videoId;
        if (!ytdl.validateID(videoId)) {
            return res.status(400).send('Invalid YouTube Music ID');
        }

        const videoInfo = await getVideoInfoWithRetry(videoId);
        const musicTitle = videoInfo.videoDetails.title;
        
        // Set appropriate headers for streaming
        res.header('Content-Type', 'audio/mpeg');
        res.header('Content-Disposition', `inline; filename="${musicTitle}.mp3"`);
        
        const audioStream = ytdl(videoId, { 
            quality: 'highestaudio',
            requestOptions: { agent }
        });

        audioStream.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
                res.status(500).send('Error streaming music');
            }
        });

        audioStream.pipe(res);

    } catch (error) {
        console.error('Error streaming music:', error);
        if (error.message.includes('Video is no longer available')) {
            res.status(404).send('Music is no longer available');
        } else {
            res.status(500).send('Error streaming music: ' + error.message);
        }
    }
});

// Download music
app.get('/download/:videoId', async (req, res) => {
    try {
        const videoId = req.params.videoId;
        if (!ytdl.validateID(videoId)) {
            return res.status(400).send('Invalid YouTube Music ID');
        }

        const videoInfo = await getVideoInfoWithRetry(videoId);
        const musicTitle = videoInfo.videoDetails.title;
        
        // Set appropriate headers for download
        res.header('Content-Type', 'audio/mpeg');
        res.header('Content-Disposition', `attachment; filename="${musicTitle}.mp3"`);
        
        const audioStream = ytdl(videoId, { 
            quality: 'highestaudio',
            requestOptions: { agent }
        });

        audioStream.on('error', (error) => {
            console.error('Download error:', error);
            if (!res.headersSent) {
                res.status(500).send('Error downloading music');
            }
        });

        audioStream.pipe(res);

    } catch (error) {
        console.error('Error downloading music:', error);
        if (error.message.includes('Video is no longer available')) {
            res.status(404).send('Music is no longer available');
        } else {
            res.status(500).send('Error downloading music: ' + error.message);
        }
    }
});

app.listen(port, () => {
    console.log(`YouTube Music Server is running at http://localhost:${port}`);
    console.log(`Available endpoints:`);
    console.log(`- Stream music: http://localhost:${port}/stream/:videoId`);
    console.log(`- Download music: http://localhost:${port}/download/:videoId`);
});