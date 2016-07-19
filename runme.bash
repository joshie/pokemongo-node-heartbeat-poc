#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

# Download nodejs
OS=$(uname -s | tr A-Z a-z)

export USERNAME
export PASSWORD

if [ -d "node-runtime" ]; then
  echo You already have a Node Runtime in this folder. If it is not good, please rm node-runtime
else
  echo Downloading Node Runtime
  curl https://nodejs.org/download/release/v0.10.46/node-v0.10.46-$OS-x64.tar.gz | tar zx
  mv node-* node-runtime
fi

export PATH=$DIR/node-runtime/bin:$PATH

if [ -d "node_modules/s2" ]; then
  echo Looks like you have node-s2 already successfully, if not, please rm node_modules/s2
else
  if which git > /dev/null; then
    rm -rf node-s2
    git clone https://github.com/joshie/node-s2.git
    npm install ./node-s2
  else
    echo Please install git
    exit 1
  fi
fi

npm install
node ptest.js 
