const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

let waitingPlayer = null;
let games = new Map();

io.on('connection', (socket) => {
    console.log('Játékos csatlakozott:', socket.id);

    if (waitingPlayer === null) {
        waitingPlayer = socket;
        socket.emit('waitingForPlayer');
    } else {
        const player1 = waitingPlayer;
        const player2 = socket;
        waitingPlayer = null;

        const gameId = player1.id + '#' + player2.id;
        games.set(gameId, {
            player1: { socket: player1, choice: null },
            player2: { socket: player2, choice: null }
        });

        player1.emit('gameStart');
        player2.emit('gameStart');

        [player1, player2].forEach(player => {
            player.on('makeChoice', (choice) => handleChoice(gameId, player.id, choice));
        });
    }

    socket.on('disconnect', () => {
        console.log('Játékos kilépett:', socket.id);
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
        
        // Értesítjük az ellenfelet, ha volt játékban
        for (let [gameId, game] of games) {
            if (game.player1.socket === socket && game.player2.socket) {
                game.player2.socket.emit('opponentDisconnected');
                games.delete(gameId);
            } else if (game.player2.socket === socket && game.player1.socket) {
                game.player1.socket.emit('opponentDisconnected');
                games.delete(gameId);
            }
        }
    });
});

function handleChoice(gameId, playerId, choice) {
    const game = games.get(gameId);
    if (!game) return;

    if (game.player1.socket.id === playerId) {
        game.player1.choice = choice;
    } else if (game.player2.socket.id === playerId) {
        game.player2.choice = choice;
    }

    if (game.player1.choice && game.player2.choice) {
        const result1 = getGameResult(game.player1.choice, game.player2.choice);
        const result2 = getGameResult(game.player2.choice, game.player1.choice);

        game.player1.socket.emit('gameResult', {
            result: result1,
            playerChoice: game.player1.choice,
            opponentChoice: game.player2.choice
        });

        game.player2.socket.emit('gameResult', {
            result: result2,
            playerChoice: game.player2.choice,
            opponentChoice: game.player1.choice
        });

        // Reset choices for next round
        game.player1.choice = null;
        game.player2.choice = null;
    }
}

function getGameResult(choice1, choice2) {
    if (choice1 === choice2) return 'draw';
    
    const wins = {
        rock: 'scissors',
        paper: 'rock',
        scissors: 'paper'
    };
    
    return wins[choice1] === choice2 ? 'win' : 'lose';
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Szerver fut: http://localhost:${PORT}`);
});