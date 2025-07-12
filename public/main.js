const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const joinButton = document.getElementById('joinButton');
const hangupButton = document.getElementById('hangupButton');
const roomName = document.getElementById('roomName');

let localStream;
let remoteStream;
let peerConnection;
let socket;

const servers = {
    'iceServers': [
        {
            'urls': 'stun:stun.l.google.com:19302'
        }
    ]
};

joinButton.onclick = joinRoom;
hangupButton.onclick = hangUp;

async function joinRoom() {
    if (!roomName.value) {
        alert('Please enter a room name');
        return;
    }

    socket = io();

    socket.on('connect', () => {
        socket.emit('message', { type: 'join', room: roomName.value });
    });

    socket.on('message', async (message) => {
        if (message.type === 'joined') {
            console.log('Joined room ' + message.room);
            joinButton.disabled = true;
            hangupButton.disabled = false;
            await start();
        } else if (message.type === 'offer') {
            if (!peerConnection) {
                await start();
            }
            await peerConnection.setRemoteDescription(new RTCSessionDescription(message));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('message', { type: 'answer', room: roomName.value, sdp: peerConnection.localDescription });
        } else if (message.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(message));
        } else if (message.type === 'candidate') {
            const candidate = new RTCIceCandidate({
                sdpMLineIndex: message.label,
                candidate: message.candidate
            });
            await peerConnection.addIceCandidate(candidate);
        }
    });
}

async function start() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        localVideo.srcObject = localStream;

        createPeerConnection();

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('message', { type: 'offer', room: roomName.value, sdp: peerConnection.localDescription });

    } catch (e) {
        console.error('Error starting video chat: ', e);
    }
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('message', {
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate,
                room: roomName.value
            });
        }
    };

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
        remoteStream = event.streams[0];
    };
}

function hangUp() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (socket) {
        socket.close();
    }
    joinButton.disabled = false;
    hangupButton.disabled = true;
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
}