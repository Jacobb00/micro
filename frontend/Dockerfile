FROM node:20-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN if [ ! -f /usr/share/nginx/html/favicon.ico ]; then touch /usr/share/nginx/html/favicon.ico; fi
RUN if [ ! -f /usr/share/nginx/html/manifest.json ]; then echo '{"short_name":"E-Ticaret","name":"Mikro Servis E-Ticaret Uygulaması","icons":[{"src":"favicon.ico","sizes":"64x64 32x32 24x24 16x16","type":"image/x-icon"}],"start_url":".","display":"standalone","theme_color":"#000000","background_color":"#ffffff"}' > /usr/share/nginx/html/manifest.json; fi

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"] 