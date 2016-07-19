var request = require('request');

module.exports.t = function(callBack){
var options = {
  url: 'https://sso.pokemon.com/sso/login?service=https%3A%2F%2Fsso.pokemon.com%2Fsso%2Foauth2.0%2FcallbackAuthorize',
  headers: {
    'User-Agent': 'niantic'
  }
};
  request.get(options,function(err, response, body) {
    callBack(body);
  });
}
