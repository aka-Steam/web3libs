FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite reads this variable at build time.
# For docker-compose deployment we use nginx reverse-proxy /rpc -> anvil.
ARG VITE_RPC_URL=/rpc
ENV VITE_RPC_URL=$VITE_RPC_URL

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
