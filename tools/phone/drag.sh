#!/bin/bash
# Gesto continuo con il dito sul telefono (motionevent): DOWN in (x0,y0), MOVE fino a (x1,y1),
# opzionalmente prosegue fino a (x2,y2), poi UP. Coordinate in pixel fisici dello schermo nell'orientamento corrente.
# Uso: tools/phone/drag.sh x0 y0 x1 y1 [x2 y2]
# Da zsh, se le coordinate stanno in una variabile, passarle con ${=VAR} (zsh non divide le variabili in parole).
seg() { local ax=$1 ay=$2 bx=$3 by=$4 n=$5; for i in $(seq 1 $n); do adb shell input motionevent MOVE $((ax + (bx-ax)*i/n)) $((ay + (by-ay)*i/n)); done; }
adb shell input motionevent DOWN $1 $2
seg $1 $2 $3 $4 8
if [ -n "$5" ]; then seg $3 $4 $5 $6 8; fi
sleep 0.2
adb shell input motionevent UP ${5:-$3} ${6:-$4}
