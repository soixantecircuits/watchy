# filewatcher

A basic app that can watch and send files modification over Socket.IO

## Simulation mode

This is the simulation mode. You need to setup the original folder where you are storing your photo
and the destination folder where the horde.js will watch. By default the horde watch a `.example`
folder and create a watchy for each numbered folder that exist in this main folder.
Thus you will end up with one watchy process for each of your folder.

To play :

`node horde.js` 
`node simulator.js`

Be sure to check that you do not have any images in you watched folder before launching the
horde has watchy will ignore existing file and only emit for new ones. 

## Installation

Watchy is not compatible with nodejs over `v0.12.x`. In case you need it, use [nvm](https://github.com/creationix/nvm) and `nvm use 0.12.7`.

- Install system dependencies:
```bash
$ sudo add-apt-repository ppa:chris-lea/node.js && sudo apt-get update
$ sudo apt-get install nodejs
$ sudo apt-get install avahi-daemon avahi-discover libnss-mdns libavahi-compat-libdnssd-dev curl build-essential
```
- Clone repo and install packages:
```bash
$ git clone git@github.com:soixantecircuits/watchy.git && cd watchy
$ npm install
```
- Copy the example config et fill it with your own:
```bash
$ cp config/config.example.json config/config.json
$ vim config/config.json
```
Be careful with the servicelookup name
- Launch it:
``` bash
$ npm start
```
Important note: The device must be connected to a network which can access the internet

## Troubleshooting

#### Linux:

- `Waiting...Fatal error: watch ENOSPC` :

  You can just type `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p` in a terminal. Read [here](http://stackoverflow.com/questions/16748737/grunt-watch-error-waiting-fatal-error-watch-enospc) for explanations.

- `The program 'nodejs' called 'DNSServiceRegister()' which is not supported (or only supported partially) in the Apple Bonjour compatibility layer of Avahi.`

  You can ignore it for now. Don't forget that the config files allows you to specify the server that you want to connect to.

## TODO

- Don't connect twite to the same service/adress
- Find nice name that no one has thought of.
