const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK = process.env.N8N_WEBHOOK_URL;
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Mock audio response (synthesized "Hello, this is a mock response")
// In a real app, this would come from n8n
app.post('/api/talk', upload.single('audio'), async (req, res) => {
    try {
        console.log('Received audio file.');

        if (!req.file) {
            return res.status(400).send('No audio file provided.');
        }

        if (MOCK_MODE) {
            console.log('MOCK_MODE is ON. Returning mock audio.');
            // For MVP simplicity, we might fail here if we don't have a mock file to serve.
            // Let's create a minimal wav header or just send back the same audio to prove roundtrip
            // if we don't have a specific mock file ready.
            // BETTER: Respond with the input file itself as an "echo" for the Hello World test.
            
            res.set('Content-Type', 'audio/wav'); // Assume webm/wav
            return res.send(req.file.buffer);
        }

        // Forward to n8n
        console.log(`Forwarding to n8n: ${N8N_WEBHOOK}`);
        
        // Construct form data
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: 'input.webm', // Web browsers usually send webm from MediaRecorder
            contentType: req.file.mimetype,
        });

        const n8nResponse = await axios.post(N8N_WEBHOOK, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            responseType: 'arraybuffer' // We expect binary audio back
        });

        console.log('Received response from n8n');
        
        // Forward headers if needed, but mainly content-type
        res.set('Content-Type', n8nResponse.headers['content-type'] || 'audio/mpeg');
        res.send(n8nResponse.data);

    } catch (error) {
        console.error('Error processing audio:', error.message);
        res.status(500).send('Error processing voice request.');
    }
});

app.listen(PORT, () => {
    console.log(`Gateway server running at http://localhost:${PORT}`);
    console.log(`Mode: ${MOCK_MODE ? 'MOCK' : 'LIVE (n8n)'}`);
});
