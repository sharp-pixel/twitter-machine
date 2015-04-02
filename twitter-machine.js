var Followers = new Mongo.Collection('followers');

if (Meteor.isClient) {
  //Meteor.subscribe('whoami');
  Meteor.subscribe('followers');

  Session.setDefault('me', '');
  Session.setDefault('followers', []);
  
  Template.input.helpers({
  });

  Template.input.events({
    'submit .list-followers': function(event) {
      var username = event.target.username.value;

      // Call server method to do the work
      Meteor.call('getFollowers', username, function(err, res) {
        console.log('Done getting followers');
      });
    }
  });

  Template.body.helpers({
    followers: function() {
      return Followers.find({});
    }
  });

  Template.whoami.helpers({
    whoami: function() {
      var me = Meteor.call('whoami', function(err, res) {
        Session.set('me', res); // set the session variable that will be used by the template helper.
      });
    }
  });
}

if (Meteor.isServer) {
  var T, me = '', Future;

  Meteor.startup(function () {
    var Twit = Meteor.npmRequire('twit');
    Future = Npm.require('fibers/future');

    var twitter_secret_string = Assets.getText('twitter-secret.json');
    var twitter_secret = JSON.parse(twitter_secret_string);

    T = new Twit(twitter_secret);

    T.get('account/settings', {}, function(err, data, response) {
      me = data.screen_name;
    });
  });

  Meteor.publish('followers', function() {
    return Followers.find();
  });

  Meteor.methods({
    'whoami' : function() {
      return me;
    },
    'getFollowers' : function(username) {
      console.log('Getting followers server-side');

      var future = new Future();

      T.get('followers/list',
        {
          screen_name: username,
          count: 200
        },
        function(err, data, response) {
          var count = 0;
          var max_followers = 25;
          var regexp = /.*paris/i;
          var followers = [];

          if (data != null) {
            data.users.forEach(function(user) {
              if (user.location !== '') {
                //console.log('Follower ' + user.name + ' (' + user.lang + ') lives in ' + user.location);

                if (regexp.exec(user.location)) {
                  if (count < max_followers) {
                    followers.push({screen_name: user.screen_name});
                    ++count;
                  }
                }
              }
              else {
                //console.log('Follower ' + user.name + ' (' + user.lang + ') could not be localized');
              }
            });
            console.log('done');

            future['return'](followers); // Set future value
          }
        }
      );

      var followers = future.wait(); // Wait for future to have its value set

      future = new Future();
      var count = 0;
      // Check whether already following
      followers.forEach(function(user, index, array) {
        T.get('friendships/show',
        {
          source_screen_name: me,
          target_screen_name: user.screen_name
        }, function(err, data, response) {
          if (data !== null && data.relationship!== null) {
            if (!data.relationship.source.following) {
              console.log('Request to follow @' + user.screen_name);

              array[index].following = false;
            }
            else {
              console.log('Already following @' + user.screen_name);

              array[index].following = true;
            }
          }
          else {
            console.log('Hmmm. data is null ')
          }
          ++count;
          if (count == array.length) future['return']();
        });
      });

      future.wait();

      // T.post('friendships/create',
      // {
      //   screen_name: user.screen_name
      // },
      // function(err, data, response) {
      //   console.log(data);
      // });

      followers.forEach(function(user) {
        user.createdAt = new Date();
        Followers.insert(user);
      });

      console.log('Done');
    }
  });
}
