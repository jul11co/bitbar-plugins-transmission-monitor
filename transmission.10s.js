#!/usr/bin/env node

// <bitbar.title>Transmission Monitor</bitbar.title>
// <bitbar.author>Jul11Co</bitbar.author>
// <bitbar.author.github>Jul11Co</bitbar.author.github>
// <bitbar.desc>Monitor Tranmission torrent downloads</bitbar.desc>
// <bitbar.dependencies>node, npm, npm/bytes, npm/transmission</bitbar.dependencies>

// To install
// npm install bytes transmission 

var bytes = require('bytes');
var Transmission = require('transmission');

var transmission = new Transmission({
  host: 'localhost',             // default: 'localhost'
  port: 9091,                    // default: 9091
  username: 'transmission',      // default: blank
  password: '12345678'           // default: blank
});

var cheek_free_space = false;
var remote_path = '/REMOTE/PATH/TO/CHECK';
var free_space_str = '';

// console.log("🐶");console.log('---');

// Get torrent state 
function getStatusType(type){
  if(type === 0){
    return 'STOPPED';
  } else if(type === 1){
    return 'CHECK_WAIT';
  } else if(type === 2){
    return 'CHECK';
  } else if(type === 3){
    return 'DOWNLOAD_WAIT';
  } else if(type === 4){
    return 'DOWNLOAD';
  } else if(type === 5){
    return 'SEED_WAIT';
  } else if(type === 6){
    return 'SEED';
  } else if(type === 7){
    return 'ISOLATED';
  }
  // return transmission.statusArray[type]
}

function trimText(input, max_length) {
  if (!input || input == '') return '';
  max_length = max_length || 60;
  var output = input.trim();
  if (output.length > max_length) {
    output = output.substring(0, max_length) + '...';
  }
  return output;
}

function getAllTorrents(options, callback){
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function(err) {};

  transmission.get(function(err, result){
    if (err){
      // console.log(err);
      return callback(err);
    }
    else {
      // console.log(result);
      if (result) return callback(null, result.torrents || []);
      else return callback(new Error('Invalid result'));
    }
  });
}

function getFreeSpace(remote_path, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function(err) {};

  // get Free Space
  transmission.freeSpace(remote_path, function(err, result){
    if (err){
      return callback(err);
    }

    callback(null, result);
  });
}

///

function printActiveTorrents(torrents) {

  var active_torrents = torrents.filter(function(torrent) {
    return (torrent.status >= 3 && torrent.status <= 6);
  });

  active_torrents.sort(function(a,b) {
    if (a.percentDone>b.percentDone) return -1;
    if (a.percentDone<b.percentDone) return 1;
    return 0;
  });
  active_torrents.sort(function(a,b) {
    if (a.status>b.status) return 1;
    if (a.status<b.status) return -1;
    return 0;
  });

  active_torrents.forEach(function(torrent, idx) {
    var percentage = (torrent.percentDone*100).toFixed(1);
    var prefix = '';
    if (idx >= 10) prefix = '--';
    if (idx == 10 && active_torrents.length > 10) {
      console.log('More (' + (active_torrents.length-10) + ')...');
    } 
    if (torrent.status == 3 && torrent.error) {
      console.log(prefix + '⏸ ' + bytes(torrent.totalSize) + ' ' + percentage + '% ' 
        + trimText(torrent.name,30) + ' | color=red');
      console.log(prefix + ' ' + bytes(torrent.totalSize) + ', ' + percentage + '% | color=grey');
      console.log(prefix + "Error: "+ trimText(torrent.errorString,40) + ' | color=grey');
    }
    else if (torrent.status == 3) {
      console.log(prefix + '⏸ ' + trimText(torrent.name,30) + ' | color=orange');
      console.log(prefix + ' ' + bytes(torrent.totalSize) + ', ' + percentage + '% | color=grey');
    } 
    else if (torrent.status == 4) {
      console.log(prefix + '⏬ ' + trimText(torrent.name,30) + ' | color=blue');
      console.log(prefix + ' ' + bytes(torrent.totalSize) + ', ' + percentage + '%, ' 
        + " ▼ " + bytes(torrent.rateDownload) + '/s, ▲ ' + bytes(torrent.rateUpload) + '/s | color=grey');
    }
    else if (torrent.status == 6) {
      console.log(prefix + '⏫ ' + trimText(torrent.name,30) + ' | color=green');
      console.log(prefix + ' ' + bytes(torrent.totalSize) + ', ' + percentage + '%, ' 
        + " ▼ " + bytes(torrent.rateDownload) + '/s, ▲ ' + bytes(torrent.rateUpload) + '/s | color=grey');
    }
    else if (torrent.status == 5) {
      console.log(prefix + '⏸ ' + trimText(torrent.name,30) + ' | color=green');
      console.log(prefix + ' ' + bytes(torrent.totalSize) + ', ' + percentage + '% | color=grey');
    }
    console.log(prefix+'---');
  });
}

function update(done) {
  // get all torrents
  getAllTorrents(function(err, torrents) {
    if (err) {
      // console.log(err);
      return done(err);
    } else if (!torrents || torrents.length == 0) {
      console.log("�");console.log('---');
      if (free_space_str) {
        console.log(free_space_str);
        console.log('---');
      }
      console.log('No torrents | color=black');
      return done();
    }

    var torrent_stats = {};
    torrents.forEach(function(torrent) {
      if (torrent.status >= 0  && torrent.status <= 7) {
        var status = getStatusType(torrent.status);
        torrent_stats[status] = torrent_stats[status] || [];
        torrent_stats[status].push(torrent);
      }
    });

    var downloading = torrent_stats['DOWNLOAD'] ? torrent_stats['DOWNLOAD'].length : 0;
    var seeding = torrent_stats['SEED'] ? torrent_stats['SEED'].length : 0;
    console.log("🐶 " + downloading + '/' + seeding);console.log('---');

    if (free_space_str) {
      console.log(free_space_str);
      console.log('---');
    }

    for (var status in torrent_stats) {
      console.log(status + ': ' + torrent_stats[status].length + '');
      torrent_stats[status].forEach(function(torrent) {
        var percentage = (torrent.percentDone*100).toFixed(1);
        console.log('--[' + bytes(torrent.totalSize) + '] ' + percentage + '% ' 
          + trimText(torrent.name,30) + ' | color=black');
      });
      // console.log('---');
    }
    console.log('---');

    printActiveTorrents(torrents);

    return done();
  });
}

if (cheek_free_space) {
  getFreeSpace(remote_path, function(err, result) {
    if (result && result['size-bytes']) {
      free_space_str = 'Free Space: ' + bytes(result['size-bytes']);
    }
    update(function(err) {});
  });
} else {
  update(function(err) {});
}

