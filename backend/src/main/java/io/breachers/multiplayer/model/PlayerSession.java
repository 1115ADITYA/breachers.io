package io.breachers.multiplayer.model;

import io.breachers.multiplayer.dto.PlayerState;
import org.springframework.web.socket.WebSocketSession;

import java.util.concurrent.atomic.AtomicInteger;

public class PlayerSession {

    private final String socketId;
    private final String playerId;
    private final String username;
    private final WebSocketSession session;

    private volatile PlayerState state;

    // Rate limiting tracking
    private volatile long windowStartTimeMs;
    private final AtomicInteger messageCountInWindow = new AtomicInteger(0);

    public PlayerSession(String socketId, String playerId, String username, WebSocketSession session, PlayerState initialState) {
        this.socketId = socketId;
        this.playerId = playerId;
        this.username = username;
        this.session = session;
        this.state = initialState;
        this.windowStartTimeMs = System.currentTimeMillis();
    }

    public String getSocketId() {
        return socketId;
    }

    public String getPlayerId() {
        return playerId;
    }

    public String getUsername() {
        return username;
    }

    public WebSocketSession getSession() {
        return session;
    }

    public PlayerState getState() {
        return state;
    }

    public void updateState(PlayerState newState) {
        this.state = newState;
    }

    /**
     * Rate limiter: check if client exceeds max messages per second
     * @param maxPerSecond e.g. 35 msgs/sec
     * @return true if allowed, false if rate limit exceeded
     */
    public boolean checkRateLimit(int maxPerSecond) {
        long now = System.currentTimeMillis();
        if (now - windowStartTimeMs >= 1000) {
            windowStartTimeMs = now;
            messageCountInWindow.set(1);
            return true;
        }

        int current = messageCountInWindow.incrementAndGet();
        return current <= maxPerSecond;
    }

    public boolean isOpen() {
        return session != null && session.isOpen();
    }
}
