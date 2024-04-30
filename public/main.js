let localStream;
let peerConnections = {};
const localVideo = document.getElementById('localVideo');
const remoteVideos = document.getElementById('remoteVideos');
const muteButton = document.getElementById('muteButton');
const hangupButton = document.getElementById('hangupButton');
const ws = new WebSocket('wss://your-server.com/ws');

navigator.mediaDevices.getUserMedia({video: true, audio: true})
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
    });

ws.onmessage = (message) => {
    const data = JSON.parse(message.data);

    if (data.offer) {
        const peerConnection = new RTCPeerConnection();
        peerConnections[data.id] = peerConnection;

        const remoteVideoContainer = document.createElement('div');
        remoteVideoContainer.className = 'remoteVideoContainer';

        const remoteVideo = document.createElement('video');
        remoteVideo.className = 'remoteVideo';
        remoteVideo.autoplay = true;
        remoteVideoContainer.appendChild(remoteVideo);

        const remoteUsername = document.createElement('p');
        remoteUsername.className = 'remoteUsername';
        remoteUsername.textContent = data.username; // Assuming the username is sent in the offer
        remoteVideoContainer.appendChild(remoteUsername);

        remoteVideos.appendChild(remoteVideoContainer);

        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        peerConnection.setRemoteDescription(data.offer)
            .then(() => peerConnection.createAnswer())
            .then(answer => {
                return peerConnection.setLocalDescription(answer);
            })
            .then(() => {
                ws.send(JSON.stringify({answer: peerConnection.localDescription, id: data.id}));
            });
    } else if (data.answer) {
        const peerConnection = peerConnections[data.id];
        if (peerConnection) {
            peerConnection.setRemoteDescription(data.answer);
        }
    } else if (data.remove) {
        const videoContainer = document.getElementById(data.id);
        if (videoContainer) {
            videoContainer.remove();
        }
        const peerConnection = peerConnections[data.id];
        if (peerConnection) {
            peerConnection.close();
            delete peerConnections[data.id];
        }
    }
};

muteButton.onclick = () => {
    localStream.getTracks().forEach(track => {
        if (track.kind === 'audio') {
            track.enabled = !track.enabled;
        }
    });
    muteButton.textContent = localStream.getTracks()[0].enabled ? 'Mute' : 'Unmute';
};

hangupButton.onclick = () => {
    ws.close();
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    while (remoteVideos.firstChild) {
        remoteVideos.firstChild.remove();
    }
};

// Rest of the code will be for handling ICE candidates