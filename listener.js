const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT =  7003 // Port for the webhook listener
const bankApiUrl =  'http://localhost:3001'; // Replace with your bank API URL
const axios = require('axios');


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
app.post('/webhooks/topic/:topic', async (req, res) => {
    console.log('Webhook event received:');
    console.log('Topic:', req.params.topic);
    console.log("the body :",JSON.stringify(req.body, null, 2)); // Pretty-print the webhook payload

    if(req.params.topic === 'basicmessages'){
        messages.push(req.body);
        console.log("Messages: ", messages);
    }

    // connections topic if state is response sending the event 
    else if(req.params.topic === 'connections' && req.body.state === 'active'){
        console.log("Connection response: ", req.body);
        let connectionResponse = req.body;
        app.get("/events/connections/:invitation_msg_id", (req, res) => {
            if(req.params.invitation_msg_id === connectionResponse.invitation_msg_id){
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("Connection", "keep-alive");

                console.log("event hit for connection id: ", req.params.invitation_msg_id);
                // Send a message to the client every 5 seconds until the connection is closed            
                setInterval(() => {
                    res.write(`data: ${JSON.stringify(connectionResponse)}\n\n`);
                    
                }, 5000);
            }
        res.on("close", () => {
            // clearInterval(interval);
            res.end();
            console.log("Client disconnected");
        });
        });
    }

    // issue credential topic if state is done post request to bank server to register the employee
    else if(req.params.topic === 'issue_credential_v2_0' && req.body.state === 'done'){
        console.log("Issue Credential Response: ", req.body);

        // console.log("Issue Credential Response.by_format: ", issueCredentialResponse.by_format);
        const issueCredentialResponse = req.body;

          // Extract attributes from the credential
        const attributes = req.body?.by_format?.cred_issue?.indy?.values;
        console.log("attributes: ", attributes);

          // Check for a attribute credential_type
        const hasEmployeeId = attributes?.credential_type?.raw === 'employeeId';
        console.log("hasEmployeeId: ", hasEmployeeId);

        const hasPermission = attributes?.credential_type?.raw === 'basePermission' || attributes?.credential_type?.raw === 'delegatedPermission';
        console.log("hasPermission: ", hasPermission);


        if (hasEmployeeId) {
            // Send a POST request to the bank server to register the employee
            try {
                const response = await axios.post(`${bankApiUrl}/auth/register`, issueCredentialResponse);
                console.log("Employee registered successfully:", response.data);
            } catch (error) {
                console.error("Error registering employee:", error);
            }
        } else if (hasPermission) {
            console.log("hasPermission is true");
            try {
                const response = await axios.post(`${bankApiUrl}/auth/permissions/new`, issueCredentialResponse);
                console.log("Permission added successfully:", response.data);
            }
            catch (error) {
                console.error("Error adding permission:", error);
            }
        }
        else{
            console.log("credential is not employee id or permission credential");
        }
    }

    // present proof topic if state is verified
    else if(req.params.topic === 'present_proof_v2_0' && req.body.state === 'done'){
        console.log("Present Proof Response: ", req.body);
        let presentProofResponse = req.body;        
        app.get("/events/proof-status/:connection_id", (req, res) => {
            if(req.params.connection_id === presentProofResponse.connection_id){
                // res.setHeader("Content-Type", "text/event-stream");
                // res.setHeader("Cache-Control", "no-cache");
                // res.setHeader("Connection", "keep-alive");

                console.log("proof event hit for connection id: ", req.params.connection_id);
            
                    console.log("Proof verified for connection: ", req.params.connection_id);
                    res.status(200).json(presentProofResponse);
          
             
                
            }
            // res.on("close", () => {
                
            //     res.end();
            //     console.log("Client disconnected");
            // }); 
        });   
    }

    // Respond with 200 OK to acknowledge receipt of the webhook event
    res.status(200).send('Webhook event received');
});
///--End even webhook---//

// present proof from banks
app.post("/webhooks/present-proof", async (req, res) => {
  const { connection_id, state, verified } = req.body;

  if (state === "verified" && verified === "true") {
    console.log(`Proof verified for connection: ${connection_id}`);
  } else {
    console.log(`Verification failed for connection: ${connection_id}`);
  }

  res.sendStatus(200);
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
