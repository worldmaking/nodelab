sudo pm2 stop server.js
sudo pm2 delete 0
sudo pm2 start server.js -o output.log -e error.log
sudo pm2 save

