const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local'
  }
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const waitForTable = async (tableName, maxRetries = 10) => {
  console.log(`Waiting for table ${tableName} to be active...`);
  let retries = maxRetries;

  while (retries > 0) {
    try {
      const { Table } = await dynamodb.describeTable({ TableName: tableName }).promise();
      if (Table.TableStatus === 'ACTIVE') {
        console.log(`Table ${tableName} is now active`);
        return true;
      }
      console.log(`Table ${tableName} status: ${Table.TableStatus}, waiting...`);
    } catch (error) {
      console.error(`Error checking table ${tableName} status:`, error);
    }
    
    await wait(2000); // Espera 2 segundos entre tentativas
    retries--;
  }

  throw new Error(`Timeout waiting for table ${tableName} to become active`);
};

const checkConnection = async () => {
  try {
    await dynamodb.listTables({}).promise();
    console.log('Successfully connected to DynamoDB');
    return true;
  } catch (error) {
    console.error('Failed to connect to DynamoDB:', error);
    return false;
  }
};

const createTasksTable = async () => {
  const params = {
    TableName: 'Tasks',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserIdIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };

  try {
    // Verifica se a tabela já existe
    try {
      await dynamodb.describeTable({ TableName: 'Tasks' }).promise();
      console.log('Tasks table already exists');
      return;
    } catch (error) {
      if (error.code !== 'ResourceNotFoundException') throw error;
    }

    // Cria a tabela se não existir
    await dynamodb.createTable(params).promise();
    console.log('Tasks table creation initiated');
    await waitForTable('Tasks');
    console.log('Tasks table created and ready');
  } catch (error) {
    console.error('Error creating Tasks table:', error);
    throw error;
  }
};

const createUsersTable = async () => {
  const params = {
    TableName: 'Users',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };

  try {
    // Verifica se a tabela já existe
    try {
      await dynamodb.describeTable({ TableName: 'Users' }).promise();
      console.log('Users table already exists');
      return;
    } catch (error) {
      if (error.code !== 'ResourceNotFoundException') throw error;
    }

    // Cria a tabela se não existir
    await dynamodb.createTable(params).promise();
    console.log('Users table creation initiated');
    await waitForTable('Users');
    console.log('Users table created and ready');
  } catch (error) {
    console.error('Error creating Users table:', error);
    throw error;
  }
};

const initializeTables = async (maxRetries = 5) => {
  let retries = maxRetries;
  
  while (retries > 0) {
    try {
      // Verifica a conexão com o DynamoDB
      const isConnected = await checkConnection();
      if (!isConnected) {
        throw new Error('Unable to connect to DynamoDB');
      }

      await createUsersTable();
      await createTasksTable();
      
      console.log('All tables initialized successfully');
      return true;
    } catch (error) {
      console.error(`Error initializing tables, retries left: ${retries - 1}`, error);
      retries--;
      
      if (retries === 0) {
        console.error('Max retries reached, failing initialization');
        throw error;
      }
      
      console.log('Waiting before retry...');
      await wait(3000); // Espera 3 segundos antes de tentar novamente
    }
  }
};

const validateTables = async () => {
  try {
    const { TableNames } = await dynamodb.listTables({}).promise();
    const requiredTables = ['Users', 'Tasks'];
    
    for (const tableName of requiredTables) {
      if (!TableNames.includes(tableName)) {
        console.error(`Required table ${tableName} is missing`);
        return false;
      }
      
      const { Table } = await dynamodb.describeTable({ TableName: tableName }).promise();
      if (Table.TableStatus !== 'ACTIVE') {
        console.error(`Table ${tableName} is not active (status: ${Table.TableStatus})`);
        return false;
      }
    }
    
    console.log('All required tables are present and active');
    return true;
  } catch (error) {
    console.error('Error validating tables:', error);
    return false;
  }
};

module.exports = {
  createTasksTable,
  createUsersTable,
  initializeTables,
  validateTables,
  checkConnection
};