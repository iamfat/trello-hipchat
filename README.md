trello-hipchat
==============

Trello to Hipchat Updater

```bash
$ git clone https://github.com/iamfat/trello-hipchat.git
$ cd trello-hipchat
$ # modify your config.yaml
$ heroku login
$ heroku create <your-trello-hipchat>
$ git push heroku master
$ heroku logs
$ heroku open
```

## Configuration
You need to modify `config.yaml` before launch your app.

```yaml
---
common:
  trello:
    callbackURL: https://your-app.herokuapp.com/notify
    apiKey: <trelloAPIKey>
    apiSecret: <trelloAPISecret>
    token: <trelloToken>
  hipchat:
    sender: Trello
    token: <hipchatAuthToken>
connections:
- name: board1
  trello:
    boardId: <trelloBoardId1>
  hipchat:
    room: room1
- name: board2
  trello:
    boardId: <trelloBoardId2>
  hipchat:
    room: room2
...
```