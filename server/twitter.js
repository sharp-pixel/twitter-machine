Future = Npm.require('fibers/future');

GetFollowersID = function(T, username) {
  var cursor = -1;
  var followers = [];

  // Get followers
  do {
    var future = new Future();

    T.get('followers/ids',
      {
        screen_name: username,
        count: 5000,
        cursor: cursor
      },
      function(err, data, response) {
        if (data != null) {        
          data.ids.forEach(function(id) {
            followers.push(id);
          });

          future['return']({
            cursor: data.next_cursor
          }); // Set future value
        }
        else {
          // Limit reached, dispatch on another process ?
          console.log('Request limit reached for command "GET followers/ids"');
          future['return']({
            cursor: 0
          });
        }
      }
    );

    var res = future.wait(); // serialize at this point

    cursor = res.cursor;
  } while (cursor != 0);
  
  return followers;
};

GetFriendsID = function(T, username) {
  var cursor = -1;
  var friends = [];

  // Get friends
  do {
    var future = new Future();

    T.get('friends/ids',
      {
        screen_name: username,
        count: 5000, // 5000 is the biggest chunk size allowed by Twitter.
        cursor: cursor
      },
      function(err, data, response) {
        if (data != null) {        
          data.ids.forEach(function(id) {
            friends.push(id);
          });

          future['return']({
            cursor: data.next_cursor
          }); // Set future value
        }
        else {
          // Limit reached, dispatch on another process ?
          console.log('Request limit reached for command "GET friends/ids"');
          future['return']({
            cursor: 0
          });
        }
      }
    );

    var res = future.wait(); // 

    cursor = res.cursor;
  } while (cursor != 0);

  return friends;
};

// Get Twitter user objects from IDs
HydrateIDs = function(T, array) {
  var result = [];

  if (array == null) {
    console.log('null array');

    return result;
  }

  // Perform hydration in chunks of 100 people at a time.
  // 100 is the max chunk size allowed by Twitter.
  for (var i = 0; i < array.length; i += 100) {
    var future = new Future();
    var temp = array.slice(i, i + 100).join();

    T.get('users/lookup',
      {
        user_id: temp,
        include_entities: true
      },
      function(err, data, response) {
        if (data != null) {
          future['return'](data);
        }
        else {
          console.log('Request limit reached for command "GET users/lookup"');
          future['return']([]);
        }
      }
    );

    var res = future.wait();

    if (res.length == 0) {
      break; // stop loop when no data is returned, most likely due to rate limit.
    }

    console.log(i + '/' + array.length);

    result = result.concat(res);
  }

  return result;
};

FollowUser = function(T, sn) {
  T.post('friendships/create',
  {
    screen_name: sn
  },
  function(err, data, response) {
    if (err) {
      console.log('friendships/create returned: ' + err);
    }
    else {
      console.log('Followed @' + data.screen_name);
    }
  });
};
