#!/bin/bash

cd /home/ubuntu/nodelab

git reset --hard
git pull
npm install
sudo pkill node

