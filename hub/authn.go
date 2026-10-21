package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/argon2"
)

func hashPassword(pw string) string {
	salt := randBytes(16)
	h := argon2.IDKey([]byte(pw), salt, 3, 64*1024, 2, 32)
	return fmt.Sprintf("argon2id$3$65536$2$%s$%s", base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(h))
}

func checkPassword(pw, enc string) bool {
	p := strings.Split(enc, "$")
	if len(p) != 6 || p[0] != "argon2id" {
		// constant-ish work even for bad records
		argon2.IDKey([]byte(pw), []byte("xxxxxxxxxxxxxxxx"), 3, 64*1024, 2, 32)
		return false
	}
	salt, _ := base64.RawStdEncoding.DecodeString(p[4])
	want, _ := base64.RawStdEncoding.DecodeString(p[5])
	got := argon2.IDKey([]byte(pw), salt, 3, 64*1024, 2, 32)
	return subtle.ConstantTimeCompare(got, want) == 1
}

var b32 = base32.StdEncoding.WithPadding(base32.NoPadding)

func newTOTPSecret() string { return b32.EncodeToString(randBytes(20)) }

func totpAt(secret string, t time.Time) string {
	key, err := b32.DecodeString(strings.ToUpper(strings.ReplaceAll(secret, " ", "")))
	if err != nil {
		return ""
	}
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], uint64(t.Unix()/30))
	m := hmac.New(sha1.New, key)
	m.Write(msg[:])
	s := m.Sum(nil)
	o := s[len(s)-1] & 0x0f
	v := (binary.BigEndian.Uint32(s[o:o+4]) & 0x7fffffff) % 1000000
	return fmt.Sprintf("%06d", v)
}

// totpCheck accepts ±1 step and refuses a step that was already used (replay).
func totpCheck(secret, code string, now time.Time, lastStep *int64) bool {
	code = strings.TrimSpace(code)
	if len(code) != 6 {
		return false
	}
	for _, d := range []int64{0, -1, 1} {
		t := now.Add(time.Duration(d*30) * time.Second)
		step := t.Unix() / 30
		if subtle.ConstantTimeCompare([]byte(totpAt(secret, t)), []byte(code)) == 1 {
			if lastStep != nil && step <= *lastStep {
				return false
			}
			if lastStep != nil {
				*lastStep = step
			}
			return true
		}
	}
	return false
}

// Limiter: 5 failures per key -> locked 15 minutes.
type Limiter struct {
	mu sync.Mutex
	m  map[string]*lim
}
type lim struct {
	fails int
	until time.Time
}

func NewLimiter() *Limiter { return &Limiter{m: map[string]*lim{}} }

func (l *Limiter) Locked(k string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	e := l.m[k]
	return e != nil && time.Now().Before(e.until)
}
func (l *Limiter) Fail(k string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	e := l.m[k]
	if e == nil || (!e.until.IsZero() && time.Now().After(e.until)) {
		e = &lim{}
		l.m[k] = e
	}
	e.fails++
	if e.fails >= 5 {
		e.until = time.Now().Add(15 * time.Minute)
		e.fails = 0
	}
}
func (l *Limiter) Reset(k string) { l.mu.Lock(); delete(l.m, k); l.mu.Unlock() }
