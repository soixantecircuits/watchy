# filewatcher

A basic app that can watch and send modification over Socket.IO



## Installation

Install the app via npm. Clone the repo, cd into it and run `npm install`

``` bash
$ sudo add-apt-repository ppa:chris-lea/node.js
$ sudo apt-get update
$ sudo apt-get install nodejs
$ git clone git@github.com:soixantecircuits/watchy.git
$ cd watchy && npm install
```

#### Linux:
```
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```
(see [here](http://stackoverflow.com/questions/16748737/grunt-watch-error-waiting-fatal-error-watch-enospc))

If you only see a warning saying `The program 'nodejs' called 'DNSServiceRegister()' which is not supported (or only supported partially) in the Apple Bonjour compatibility layer of Avahi.` you can ignore it for now. Don't forget that the config files allows you to specify the server that you want to connect to.

> Note:
> You'll need to write manually the path to the folder you want to watch in the `config/config.json` file.

## Example Usage

``` bash
$ npm start
```

## TODO

Add forever as service.
