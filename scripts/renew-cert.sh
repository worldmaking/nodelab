#!/bin/bash

cd /home/ubuntu/nodelab/scripts

sudo ./stop-pm2.sh

sudo certbot renew

sudo ./start-pm2.sh
