# Programma SDARM — versione 2 (Mac)

Pannello per gestire il culto e proiettare inni, Bibbia, lezione, preghiere, timer e media su un secondo schermo.
Il telefono fa da telecomando.

## Installare su un Mac (Apple Silicon)

1. Apri **Releases** (a destra in questa pagina) e scarica `Programma-SDARM-<versione>-mac.zip`.
2. Fai doppio clic sullo zip: compare **Programma SDARM.app**. Trascinala in **Applicazioni**.
3. La prima volta: clic destro sull'app › **Apri** › **Apri** (l'app non è firmata da Apple).
   Se macOS la blocca comunque: Impostazioni di Sistema › Privacy e sicurezza › **Apri comunque**.
4. Per portare i tuoi dati da un altro Mac: nel vecchio Mac Impostazioni › Versione e backup › **Esporta backup…**,
   nel nuovo Mac stessa pagina › **Ripristina da backup…**.

Gli aggiornamenti si trovano dentro l'app (Impostazioni › Versione e backup).

## Pubblicare una nuova versione

Cambia `VERSION` in `webapp/server.py`, poi:

```bash
git tag -a v2.0.1 -m "Cosa cambia"
git push origin v2.0.1
```

GitHub costruisce l'app e crea la Release da solo. Dettagli tecnici in `HANDOFF.md`.
