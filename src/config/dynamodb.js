const AWS = require('aws-sdk');

const dynamodbConfig = {
  region: process.env.AWS_REGION || 'us-east-1'
};

// Se estiver em ambiente de desenvolvimento, usa o endpoint local
if (process.env.DYNAMODB_ENDPOINT) {
  dynamodbConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
  dynamodbConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  };
}

const dynamodb = new AWS.DynamoDB.DocumentClient(dynamodbConfig);

module.exports = dynamodb;
