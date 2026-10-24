package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, pwhash TEXT NOT NULL, totp_enc TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner', created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, hash TEXT UNIQUE NOT NULL, user_id INTEGER NOT NULL, created INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires INTEGER NOT NULL, ip TEXT, ua TEXT, revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS service_sessions(hash TEXT PRIMARY KEY, session_id TEXT NOT NULL, host TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tickets(hash TEXT PRIMARY KEY, session_id TEXT NOT NULL, host TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS enroll_codes(hash TEXT PRIMARY KEY, name TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, pubkey TEXT NOT NULL, status TEXT NOT NULL, hostname TEXT, versions TEXT, created INTEGER NOT NULL, last_seen INTEGER);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, user TEXT, ip TEXT, action TEXT NOT NULL, target TEXT, result TEXT);
`

type Store struct {
	db  *sql.DB
	key []byte // master key for encrypting TOTP secrets
}

func OpenStore(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", "file:"+filepath.Join(dir, "hub.db")+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		return nil, err
	}
	// migrations (idempotent)
	_, _ = db.Exec(`ALTER TABLE sessions ADD COLUMN reauth_at INTEGER NOT NULL DEFAULT 0`)
	key, err := loadOrCreateKey(filepath.Join(dir, "master.key"))
	if err != nil {
		return nil, err
	}
	return &Store{db: db, key: key}, nil
}

func loadOrCreateKey(p string) ([]byte, error) {
	if b, err := os.ReadFile(p); err == nil {
		k, err := hex.DecodeString(string(b))
		if err != nil || len(k) != 32 {
			return nil, errors.New("master.key invalid")
		}
		return k, nil
	}
	k := randBytes(32)
	if err := os.WriteFile(p, []byte(hex.EncodeToString(k)), 0o600); err != nil {
		return nil, err
	}
	return k, nil
}

func (s *Store) seal(plain []byte) string {
	b, _ := aes.NewCipher(s.key)
	g, _ := cipher.NewGCM(b)
	n := randBytes(g.NonceSize())
	return base64.StdEncoding.EncodeToString(append(n, g.Seal(nil, n, plain, nil)...))
}

func (s *Store) open(enc string) ([]byte, error) {
	raw, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return nil, err
	}
	b, _ := aes.NewCipher(s.key)
	g, _ := cipher.NewGCM(b)
	if len(raw) < g.NonceSize() {
		return nil, errors.New("short")
	}
	return g.Open(nil, raw[:g.NonceSize()], raw[g.NonceSize():], nil)
}

func (s *Store) Audit(user, ip, action, target, result string) {
	s.db.Exec(`INSERT INTO audit(ts,user,ip,action,target,result) VALUES(?,?,?,?,?,?)`, time.Now().Unix(), user, ip, action, target, result)
}

func randBytes(n int) []byte {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return b
}

func randToken() string { return base64.RawURLEncoding.EncodeToString(randBytes(32)) }

func hashTok(t string) string { h := sha256.Sum256([]byte(t)); return hex.EncodeToString(h[:]) }
