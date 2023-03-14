require('dotenv').config({ path: '../.env' });
const fetch = require('node-fetch');

const { API_KEY, ISSUER_DID, RECIPIENT_DID, API_URL } = process.env;

// We can send multiple credentials in one message
const CREDENTIAL_COUNT = 1;

// Helper method to POST to the API
async function apiPost(url, body) {
  const result = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'dock-api-token': API_KEY,
    },
    body: JSON.stringify(body),
    method: 'POST'
  });

  const data = await result.json();

  if (result.status >= 400) {
    throw new Error(`API Error: ${data}`);
  }

  return data;
}

// Gets credentials to send, they could be pulled from DB or previous response
// for the sample we will just issue a credential with the API
async function getCredentials() {
  const credentials = [];
  for (let i = 0; i < CREDENTIAL_COUNT; i++) {
    const credential = await apiPost(`${API_URL}/credentials`, {
      distribute: false, // Ensure distribute is false because were manually sending later
      credential: {
        name: 'University Degree',
        type: [
          'VerifiableCredential',
          'UniversityDegree'
        ],
        issuer: ISSUER_DID,
        subject: {
          id: RECIPIENT_DID,
          degreeName: 'Masters Of Demo ' + i,
          degreeType: 'Masters Degree',
          dateEarned: '2023-03-06',
          name: 'Demo User',
          email: 'demo@dock.io',
          dateOfBirth: '2003-11-27'
        }
      }
    });

    credentials.push(credential);
  }

  return credentials;
}

// Entrypoint, will get credentials, create a didcomm message and then send that message
async function main() {
  if (!API_KEY) {
    throw new Error('Setup .env file');
  }

  // Get credentials to send
  const credentials = await getCredentials();
  console.log('Creating DIDComm message with', credentials.length, ' credentials')

  // Create an encrypted didcomm message
  const didcommMessage = await apiPost(`${API_URL}/messaging/encrypt`, {
    senderDid: ISSUER_DID,
    recipientDids: [RECIPIENT_DID, ISSUER_DID],
    type: 'issue', // Message type is important for the wallet to recognize it
    payload: {
      // You can set this domain to be whatever you like, or base it from a DID/issuer profile
      domain: 'api.dock.io',

      // Credentials is an array of signed VCs
      credentials,
    }
  });

  // Finally, send the message to the user's wallets/generate QR
  // you can optionally skip this step and distribute the didcomm message another way
  const { qrUrl } = await apiPost(`${API_URL}/messaging/send`, {
    to: RECIPIENT_DID,
    message: didcommMessage.jwe,
  });

  console.log('Sent message, QR url can be used also:', qrUrl);

  // For debugging, we can show the decrypted contents since we specified
  // a DID we control as a recipient DID
  const decryptData = await apiPost(`${API_URL}/messaging/decrypt`, didcommMessage);
  console.log('Decrypted message:', decryptData)
}

main();
