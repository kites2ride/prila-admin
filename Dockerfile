# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG VITE_API_BASE_URL=https://api.prila.in/api/v1
ARG VITE_GOOGLE_MAPS_KEY=
ARG VITE_GOOGLE_MAP_ID=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_MAPS_KEY=$VITE_GOOGLE_MAPS_KEY
ENV VITE_GOOGLE_MAP_ID=$VITE_GOOGLE_MAP_ID
COPY package.json package-lock.json ./
RUN npm install
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
RUN npm run build


FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
