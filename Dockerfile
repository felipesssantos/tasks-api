# Estágio de build
FROM node:20-alpine as builder

WORKDIR /app

# Copia os arquivos de configuração
COPY package*.json ./

# Instala as dependências
RUN npm ci

# Copia o código fonte
COPY . .

# Estágio de produção
FROM node:20-alpine

WORKDIR /app

# Instalar curl para o health check
RUN apk add --no-cache curl


# Copia apenas os arquivos necessários do estágio de build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/wait-for-dynamodb.sh ./wait-for-dynamodb.sh

RUN chmod +x /app/wait-for-dynamodb.sh

# Expõe a porta 3000
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["./wait-for-dynamodb.sh", "dynamodb-local", "npm", "run", "dev"]
