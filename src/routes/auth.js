const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
});

const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'name'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 },
      name: { type: 'string' }
    }
  }
};

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' }
    }
  }
};

async function routes(fastify, options) {
  // Registro de usuário
  fastify.post('/register', { schema: registerSchema }, async (request, reply) => {
    const { email, password, name } = request.body;

    try {
      // Verifica se o email já existe
      const existingUser = await dynamodb.query({
        TableName: 'Users',
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email
        }
      }).promise();

      if (existingUser.Items.length > 0) {
        reply.code(400).send({ error: 'Email já cadastrado' });
        return;
      }

      // Cria novo usuário
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = {
        id: uuidv4(),
        email,
        password: hashedPassword,
        name,
        createdAt: new Date().toISOString()
      };

      await dynamodb.put({
        TableName: 'Users',
        Item: user
      }).promise();

      // Gera token
      const token = fastify.jwt.sign({ 
        userId: user.id,
        email: user.email 
      });

      reply.code(201).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      });
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({ error: 'Erro ao registrar usuário' });
    }
  });

  // Login
  fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
    const { email, password } = request.body;

    try {
      // Busca usuário pelo email
      const result = await dynamodb.query({
        TableName: 'Users',
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email
        }
      }).promise();

      if (result.Items.length === 0) {
        reply.code(401).send({ error: 'Credenciais inválidas' });
        return;
      }

      const user = result.Items[0];

      // Verifica senha
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        reply.code(401).send({ error: 'Credenciais inválidas' });
        return;
      }

      // Gera token
      const token = fastify.jwt.sign({ 
        userId: user.id,
        email: user.email 
      });

      reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      });
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({ error: 'Erro ao fazer login' });
    }
  });

  // Rota protegida de exemplo
  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const user = await dynamodb.get({
        TableName: 'Users',
        Key: { id: request.user.userId }
      }).promise();

      if (!user.Item) {
        reply.code(404).send({ error: 'Usuário não encontrado' });
        return;
      }

      // Remove o campo password antes de retornar
      const { password, ...userData } = user.Item;
      reply.send(userData);
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({ error: 'Erro ao buscar dados do usuário' });
    }
  });
}

module.exports = routes;
