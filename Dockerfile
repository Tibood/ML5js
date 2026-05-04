# Étape unique : serveur nginx léger pour le site statique
FROM nginx:alpine

# Supprime la page par défaut de nginx
RUN rm -rf /usr/share/nginx/html/*

# Copie tous les fichiers du projet dans le répertoire servi par nginx
COPY . /usr/share/nginx/html/

# Expose le port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
