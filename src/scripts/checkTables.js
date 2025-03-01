// scripts/checkTables.js
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
});

async function checkTables() {
  try {
    const tables = await dynamodb.listTables().promise();
    console.log('Tabelas existentes:', tables);
  } catch (error) {
    console.error('Erro ao listar tabelas:', error);
  }
}

checkTables();