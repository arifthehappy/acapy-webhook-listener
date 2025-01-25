const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = 7003 || process.env.PORT; // Port for the webhook listener

// Middleware to parse incoming JSON requests
app.use(bodyParser.json());
app.use(express.json());
app.use(cors()); // Enable CORS for all routes

let messages = [];

//get root endpoint to check if the listener is running
app.get('/', (req, res) => {
    res.send('Webhook listener running');
});


// Endpoint to listen to webhook events from ACA-Py
app.post('/webhooks/topic/:topic', (req, res) => {
    console.log('Webhook event received:');
    console.log('Topic:', req.params.topic);
    console.log("the body :",JSON.stringify(req.body, null, 2)); // Pretty-print the webhook payload

    if(req.params.topic === 'basicmessages'){
        messages.push(req.body);
        console.log("Messages: ", messages);
    }

    // Respond with 200 OK to acknowledge receipt of the webhook event
    res.status(200).send('Webhook event received');
});

// Endpoint to get all the messages
app.get('/messages', (req, res) => {
    res.send(messages);
}); 

// Endpoint to get all messages by connection id
app.get('/messages/:connection_id', (req, res) => {
    const connectionId = req.params.connection_id;
    const connectionMessages = messages.filter(message => message.connection_id === connectionId);
    res.send(connectionMessages);
});

// Endpoint to clear the messages
app.delete('/messages', (req, res) => {
    messages = [];
    res.send('Messages cleared');
});



// Start the server
app.listen(PORT, () => {
    console.log(`Webhook listener running at http://localhost:${PORT}/webhooks`);
});
