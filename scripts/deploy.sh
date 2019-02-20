#!/usr/bin/env bash

set -e

REL_DIR="`dirname \"$0\"`"
DIR=`readlink -e $REL_DIR`

cd $DIR/..

echo "Cleaning..."
lein clean

echo "Packaging..."
lein package

# Remove temp files
echo "Cleaning..."
rm -rf ./public/js/build/release

echo "Deploying..."
GIT_DEPLOY_DIR=public $DIR/git-directory-deploy.sh

echo "Done"