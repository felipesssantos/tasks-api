const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local'
  }
});

const checkConnection = async () => {
  try {
    await dynamodb.listTables({}).promise();
    console.log('Successfully connected to DynamoDB Local');
    return true;
  } catch (error) {
    console.error('Failed to connect to DynamoDB Local:', error);
    return false;
  }
};

module.exports = { checkConnection };