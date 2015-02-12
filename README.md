# filewatcher

A basic app that can watch and send files modification over Socket.IO

## Installation

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
- Launch it:
``` bash
$ npm start
```

## Troubleshooting

#### Linux:

- `Waiting...Fatal error: watch ENOSPC` :

  You can just type `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p` in a terminal. Read [here](http://stackoverflow.com/questions/16748737/grunt-watch-error-waiting-fatal-error-watch-enospc) for explanations.

- `The program 'nodejs' called 'DNSServiceRegister()' which is not supported (or only supported partially) in the Apple Bonjour compatibility layer of Avahi.`

  You can ignore it for now. Don't forget that the config files allows you to specify the server that you want to connect to.

## TODO

- Find nice name that no one has thought of.
