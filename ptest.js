var pcomm = require('./lib/pokegocomm');

var username = process.env.USERNAME || 'fake';
var password = process.env.PASSWORD || 'fake';
var latitude = parseFloat(process.env.LATITUDE) || 40.759011;
var longitude = parseFloat(process.env.LONGITUDE) || -73.984472;

var playerInfo = {
  'accessToken': '',
  'latitude': latitude,
  'longitude': longitude,
  'altitude': 0,
  'locationName': '',
  'apiEndpoint': '',
  'username': username,
  'password': password
}

pcomm.ptcLogin(playerInfo,function(err,token){
  if(err) {return console.log(err)}
  console.log('access token: ' + token);
  playerInfo.accessToken = token;
  pcomm.getApiEndpoint(playerInfo,function(err,api_endpoint){
    if(err) {return console.log(err)}
    console.log('api endpoint: ' + api_endpoint);
    playerInfo.apiEndpoint = api_endpoint;
    pcomm.getProfile(playerInfo,function(err,profile) {
      if(err) {return console.log(err)}
      console.log('got profile and authticket');
      setInterval(function() {
        pcomm.getMapObjects(playerInfo,function(err,data) {
          if(err) {console.log(err); console.log('will try again')}
          if( data.map_objects.map_cells ) {
            console.log('Pokemon Data:');
            data.map_objects.map_cells.forEach(function(cell) {
              cell.wild_pokemons.forEach(function(wild_pokemon) {
                console.log(wild_pokemon.spawnpoint_id,wild_pokemon.pokemon.pokemon_type,wild_pokemon.latitude,wild_pokemon.longitude,wild_pokemon.time_till_hidden_ms);
              });
            });
            process.exit(0);
          } else {
            console.log('failed to get data this round');
          }
        });
      },2000);
    });
  });
});
