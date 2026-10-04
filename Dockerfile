FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY server.mjs engine.mjs ./
COPY public ./public
ENV HOST=0.0.0.0
ENV PORT=4080
EXPOSE 4080
USER node
CMD ["node", "server.mjs"]
