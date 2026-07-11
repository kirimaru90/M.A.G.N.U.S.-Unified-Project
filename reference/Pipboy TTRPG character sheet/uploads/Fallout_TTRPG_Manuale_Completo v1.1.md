# FALLOUT TTRPG
## Manuale Completo del Sistema di Gioco

> *Documento di lavoro (WIP). Sistema di gioco di ruolo da tavolo leggero, asimmetrico e narrativo, ambientato nell'universo di Fallout. Il sistema sostituisce calcoli matematici (HP, danni, percentuali) con un motore a pool di dadi basato su Approcci, Tag narrativi e gestione delle risorse.*

---

## Indice

1. Filosofia del Gioco
2. Motore Base e Risoluzione delle Azioni
3. Livelli di Rischio
4. Punti Azione (PA)
5. Punti Fortuna e Punti Sfortuna (PF / PSF)
6. Creazione del Personaggio
7. Tag Skills e Maestria
8. Salute, Logoramento e Condizioni
9. Chems, Alcol e Dipendenza
10. Equipaggiamento, Tag Narrativi e Modding
11. Il Master, l'Iniziativa e i Nemici (Sistema Asimmetrico)
12. Economia: Tappi e Bobblehead
13. Esempio di Gioco Esteso

---

## 1. Filosofia del Gioco

Questo gioco è **fiction-first**. Le regole esistono per generare narrazione, non per simulare fisica. Non ci sono punti ferita, percentuali, soglie di danno o tabelle da consultare. Ogni meccanica si traduce direttamente in qualcosa che accade nel mondo: un colpo non toglie 8 HP, **ferisce un braccio** o **fa cadere l'arma**; un fallimento non è un numero sotto soglia, è **una porta che cede sotto il peso del nemico**.

Il sistema è **asimmetrico**: i giocatori tirano i dadi, il Master no. Il Master descrive, propone rischi, e quando i giocatori falliscono trasforma quel fallimento in conseguenze concrete.

Tre principi guidano ogni decisione al tavolo:

- **Mai bloccare la storia.** Un fallimento non significa "non succede nulla", significa "succede qualcosa di peggio o di diverso".
- **Le regole servono la fiction.** Se una regola contraddice una scena evidente, vince la scena.
- **Il rischio è dichiarato.** I giocatori sanno sempre cosa stanno mettendo in gioco prima di tirare.

---

## 2. Motore Base e Risoluzione delle Azioni

### 2.1 Quando si tirano i dadi

Si tirano i dadi solo quando esiste **incertezza significativa** e **un rischio reale**. Se l'azione è banale (camminare lungo un corridoio vuoto) o impossibile (saltare la luna), non si tira: succede o non succede e basta.

### 2.2 Il sistema S.P.E.C.I.A.L. come Approcci

I sette attributi classici di Fallout non rappresentano "cosa sai fare" ma "**come affronti il problema**":

| Approccio | Significato narrativo |
|---|---|
| **S — Strength** | Forza bruta, potenza fisica, intimidazione muscolare. |
| **P — Perception** | Attenzione, mira, intuito, individuare dettagli e pericoli. |
| **E — Endurance** | Resistenza fisica, tenacia, sopportare dolore e veleni. |
| **C — Charisma** | Convincere, mentire, sedurre, guidare un gruppo. |
| **I — Intelligence** | Logica, scienza, deduzione, comprendere tecnologie. |
| **A — Agility** | Velocità, riflessi, furtività, manualità fine. |
| **L — Luck** | Il jolly: affidarsi al caso anziché alle proprie capacità. |

Ogni Approccio ha un valore da **1 a 5**. Il valore indica quanti dadi si tirano quando si usa quell'Approccio.

### 2.3 Lancio dei dadi

Si tira un numero di **d6** pari al valore dell'Approccio scelto. Si guarda il risultato di ogni singolo dado:

- **6 → Successo Pieno.** Almeno un dado con questo risultato significa che l'azione riesce come dichiarata.
- **4 o 5 → Successo con Costo.** Se nessun dado mostra 6 ma almeno uno mostra 4 o 5, l'azione riesce ma con **una complicazione narrativa proporzionata alla Posizione di Rischio** (vedi §3). Il GM la inventa sul momento e la dichiara prima di proseguire.
- **1, 2, 3 → Fallimento.** Se nessun dado mostra 4, 5 o 6, l'azione fallisce e scattano le conseguenze decise dal Master in base al Livello di Rischio.

### 2.4 Vantaggio e Svantaggio

A discrezione narrativa del Master, un tiro può essere effettuato con **Vantaggio** o **Svantaggio**:

- **Vantaggio:** si aggiunge **+1 dado** al pool. Si applica quando la situazione favorisce concretamente il personaggio (è in posizione elevata, ha un'arma più adatta del previsto, il bersaglio è distratto, il tempo è dalla sua parte).
- **Svantaggio:** dopo aver tirato, si **rimuove dal calcolo il dado con il risultato più alto** ottenuto. Si applica quando la situazione lo penalizza (visibilità scarsa, fango, una distrazione, una ferita che impatta indirettamente).

Vantaggio e Svantaggio **non sono cumulabili** e **si annullano a vicenda**: un personaggio con un Vantaggio e uno Svantaggio simultanei tira normalmente. Sono dichiarati dal Master prima del tiro, leggendo la situazione di gioco.

> *Vantaggio e Svantaggio si applicano anche sui tiri di Fortuna, e sono compatibili con il V.A.T.S. (sono effetti meccanici separati).*

### 2.5 L'Approccio Fortuna ("Il Jolly")

Il giocatore può **dichiarare di usare la Fortuna** al posto di qualunque altro Approccio, per qualunque azione. Rappresenta affidarsi puramente al caso, al destino, alla provvidenza del Vault Boy.

L'uso della Fortuna come Approccio comporta queste conseguenze meccaniche:

1. **Il Livello di Rischio sale automaticamente di un grado.** Sicuro → Rischioso, Rischioso → Pericoloso.
2. **Non si può usare la Fortuna se la Posizione di Rischio è già Pericolosa**, a meno che il giocatore non spenda **prima** 1 PF per abbassare il Rischio (vedi §5). Solo allora può dichiarare il tiro di Fortuna (che riporterà il Rischio a Pericoloso).
3. **I tiri di Fortuna non generano mai PA**, indipendentemente da quanti 6 si ottengono.
4. Il giocatore può comunque spendere un PF per riportare la Posizione di Rischio al grado iniziale anche in altre situazioni.

> *Esempio: Marta si trova davanti a una serratura elettronica. Non ha né Intelligence né Agility alta, ma ha Luck 4. Dichiara: "Provo a caso, vediamo se becca la combinazione giusta". Il GM aveva fissato Rischioso → diventa Pericoloso. Marta tira 4d6. Se vuole, può spendere 1 PF per riabbassare il rischio a Rischioso.*

---

## 3. Livelli di Rischio

Prima di ogni tiro, il Master **dichiara ad alta voce** in che Posizione di Rischio si trova il personaggio. È un patto: il giocatore sa cosa sta mettendo in gioco.

| Livello | Cosa succede in caso di fallimento | Cosa significa Successo con Costo |
|---|---|---|
| 🟢 **Sicuro** | Nessun danno fisico o mentale. Si perde tempo, un'occasione, una risorsa minore. | Il costo è controllato o lieve: un dettaglio narrativo, un piccolo intoppo, niente di rilevante. |
| 🟡 **Rischioso** | Lo standard. Una Condizione standard, un'arma che si danneggia, un nemico che ti nota, una complicazione narrativa significativa. | Una complicazione concreta ma gestibile: una risorsa spesa, un'attenzione attirata, un'arma che traballa. |
| 🔴 **Pericoloso** | Sfida letale. Condizione grave (mutilazione permanente, equipaggiamento distrutto), oppure Stato Critico immediato. | Un costo pesante: una Condizione, un'arma che si danneggia, un nemico che reagisce con violenza. |

Il Master può alzare o abbassare il Livello di Rischio durante la scena se la situazione cambia (un nemico è stato disarmato, un alleato è arrivato in soccorso, una trappola è stata scoperta). Deve sempre dichiararlo prima del tiro.

---

## 4. Punti Azione (PA)

I Punti Azione sono la **risorsa personale** del personaggio: rappresentano lucidità, riflessi rimasti, energia tattica.

### 4.1 Massimo e creazione

Il massimo di PA di un personaggio è pari al **valore di Agility OPPURE di Endurance**, a scelta del giocatore in fase di creazione del personaggio. La scelta è permanente.

I personaggi iniziano la sessione con i PA al massimo, salvo diversa decisione narrativa del GM (es. la sessione comincia in mezzo a uno scontro già iniziato).

### 4.2 Recupero dei PA

Durante un Lancio dei Dadi, **ogni 6 successivo al primo 6** ottenuto in un singolo tiro restituisce 1 PA al giocatore.

> *Esempio: Carlo tira 4d6 su Strength e ottiene 6, 6, 5, 2. Il primo 6 conta come Successo Pieno. Il secondo 6 restituisce 1 PA. Il 5 (un Successo con Costo) non genera PA perché c'è già un 6.*

**Eccezioni importanti:**
- **I tiri di Fortuna non generano mai PA**, qualunque sia il risultato.
- **I dadi ottenuti tramite ritiro non generano PA.** Solo il lancio iniziale conta.
- **Le azioni consecutive ottenute con Rubare la Scena** (vedi §11) generano PA solo per la prima azione della catena.

### 4.3 Utilizzi dei PA

I PA si possono spendere per:

- **Ritirare i dadi falliti.** Costo: 1 PA. Si possono ritirare tutti i dadi falliti di un singolo lancio. **Requisito:** bisogna avere la Tag Skill pertinente all'azione (vedi §7). Senza la skill non si può ritirare, neanche pagando. L'effetto sul Rischio del ritiro dipende dal livello di Maestria della skill.
- **Rubare la Scena.** Costo: 1 PA. Permette di intervenire fuori dal proprio turno o di agire una seconda volta dopo aver appena agito. Vedi §11 per il sistema di iniziativa completo.
- **Attivare il V.A.T.S.** Costo: 1 PA. Vedi §4.4.

### 4.4 Il V.A.T.S.

Il V.A.T.S. è il meccanismo per **sfruttare un vantaggio situazionale durante un'azione**: un punto scoperto, un momento di distrazione del nemico, un'angolazione di tiro privilegiata, una debolezza che il giocatore ha individuato narrativamente.

Si attiva spendendo 1 PA **prima del tiro**. Il giocatore dichiara:

1. **Quale vantaggio situazionale sta sfruttando.** Può essere una **proposta creativa** del giocatore (es. "il predone non si è accorto che il tubo del gas accanto a lui perde, miro lì") oppure un **elemento già stabilito narrativamente** in precedenza dal GM o dalla scena.
2. **Quale effetto narrativo mirato vuole ottenere** in caso di successo. Esempi: menomare un arto, disarmare il nemico, accecarlo, distruggergli la radio, far esplodere il barile alle sue spalle, far cadere il ponteggio su di lui.

Il Master **non può rifiutare** l'attivazione del V.A.T.S. — è un diritto del giocatore. L'unica cosa che valuta è la **coerenza** del vantaggio e dell'effetto richiesti con la fiction (non si può sfruttare un vantaggio che non c'è, e l'effetto deve essere fisicamente e narrativamente plausibile).

**Risultato del tiro con V.A.T.S. attivo:**
- **Successo Pieno (6):** l'effetto narrativo mirato si applica come Tag negativo o Condizione mirata sull'avversario, l'oggetto o la scena.
- **Successo con Costo (4-5):** l'effetto narrativo mirato si applica comunque, ma con la complicazione tipica del Successo con Costo (proporzionale alla Posizione di Rischio).
- **Fallimento (1-3):** scattano le conseguenze normali del fallimento. Il PA speso è perso, l'effetto non si verifica.

> *Il V.A.T.S. è il principale strumento dei giocatori per dirigere la scena di combattimento e di azione. Il vantaggio situazionale può preesistere oppure essere "scoperto" sul momento dal giocatore con una proposta creativa.*
>
> *Nota: il V.A.T.S. non aggiunge dadi al tiro — non è un Vantaggio meccanico. Però può convivere con un Vantaggio dichiarato dal GM, perché sono effetti separati.*

---

## 5. Punti Fortuna e Punti Sfortuna (PF / PSF)

I Punti Fortuna sono una **risorsa meta-narrativa del tavolo**, gestita come un costante "tiro alla fune" tra giocatori e Master.

### 5.1 Pool e funzionamento base

Esiste un **unico pool condiviso** al tavolo. Il pool iniziale è pari al **numero totale di giocatori** (escluso il Master). All'inizio della sessione **tutti i punti sono nel pool dei giocatori** e si chiamano **Punti Fortuna (PF)**.

Quando un giocatore spende un PF, quel punto **passa al Master** e si trasforma in **Punto Sfortuna (PSF)**. Quando il Master spende un PSF, il punto **torna ai giocatori** come PF.

Non esistono PF "rigenerati" o creati dal nulla: la quantità totale di punti al tavolo resta costante per tutta la sessione, si sposta solo da una parte all'altra. Questo crea naturalmente equilibrio: più i giocatori usano PF, più il Master ha munizioni per complicare la storia, e viceversa.

### 5.2 Cosa possono fare i giocatori (1 PF, ceduto al Master come PSF)

- **Colpo Critico / Successo Critico.** Un'azione o un attacco già andato a segno diventa **decisivo, spettacolare, narrativamente preponderante**. Risolve la maggior parte della minaccia in corso, cambia le sorti della scena.
- **Abbassare il Livello di Rischio** di un grado **prima del tiro**. Particolarmente utile per neutralizzare l'aumento di rischio causato dall'Approccio Fortuna, o per poter usare la Fortuna quando il Rischio è già Pericoloso.
- **Lampo di Genio.** Il personaggio scopre — o si accorge per la prima volta — di un **elemento narrativo o fisico** presente nella scena che potenzialmente può risolvere o cambiare radicalmente la situazione: una bombola di ossigeno dimenticata in un angolo, un appiglio fino ad allora invisibile, una falla nell'argomentazione del PNG, una crepa nella parete. Il GM lo inserisce nella scena coerentemente.

### 5.3 Cosa può fare il Master (1 PSF, ceduto ai giocatori come PF)

- **Conseguenza Critica.** A seguito di un fallimento di un giocatore (1, 2 o 3 sui dadi), il Master trasforma quel fallimento in una **conseguenza disastrosa** che aggrava drasticamente i problemi del party. Se la conseguenza coinvolge un'arma o un'armatura, può **romperla direttamente** invece di danneggiarla.
- **Alzare il Livello di Rischio** di una prova **prima del tiro**.
- **Mutare la Situazione.** Un ostacolo che sembrava superato si rivela più grande del previsto, o assume una forma inaspettata. Un nemico abbattuto si rialza con una seconda forma. Il codice digitato sul tastierino non apriva la porta ma attivava l'allarme. La porta dietro cui ci si era nascosti dà su un altro corridoio pieno di nemici.
- **Danneggiare un'arma o un'armatura** (vedi §10.2). Questo si può fare indipendentemente dal risultato di un tiro: l'oggetto cede per usura nel momento meno opportuno.
- **Sfruttare le Dipendenze.** Se un personaggio ha il Tratto Negativo *Dipendente da Sostanza* (vedi §9), il Master può spendere un PSF per inserire ostacoli, malus o complicazioni causate dall'astinenza.

> *Nota: il Master può infliggere il danneggiamento di un'arma o di un'armatura anche come conseguenza diretta di un fallimento (Posizione Rischiosa), senza spendere PSF. Il PSF serve per effetti più gravi (es. rottura immediata su Conseguenza Critica) o indipendenti dal tiro.*

---

## 6. Creazione del Personaggio

La creazione segue questi passaggi:

### 6.1 Distribuzione S.P.E.C.I.A.L.

Il giocatore ha **18 punti** da distribuire tra i 7 attributi. **Nessun attributo può superare 4** in fase di creazione. **Nessun attributo può scendere sotto 1**.

> *Esempio di distribuzione equilibrata: S 3, P 3, E 3, C 2, I 3, A 3, L 1 = 18 punti.*

### 6.2 Scelta della Specie

Il giocatore sceglie una delle quattro Specie. Ognuna garantisce un **permesso narrativo assoluto** e impone uno **svantaggio**.

| Specie | Permesso narrativo | Svantaggio |
|---|---|---|
| **Umano** | Versatilità completa: nessun ambiente o gruppo gli è precluso a priori. Trova posto ovunque. | Nessun talento sovrannaturale, nessuna resistenza speciale: un colpo è un colpo. |
| **Ghoul** | Immune alle radiazioni (anzi, lo curano). Vita estremamente lunga, tollerato in alcune comunità. | Inviso e attaccato a vista nella maggior parte degli insediamenti umani. Rischio costante di "selvatichire". |
| **Supermutante** | Forza e resistenza sovrumane. Intimidazione fisica automatica. Resistenza alle radiazioni. | Quasi sempre attaccato o respinto in contesti civili. Difficoltà con tecnologie fini (terminali, serrature). |
| **Robot** | Non respira, non mangia, non beve, immune a veleni e radiazioni. Sensori potenziati. | Non può curarsi con stimpack o cibo: serve riparazione, rottami, banchi da lavoro. Vulnerabile a EMP e armi a impulsi. |

### 6.3 Scelta dei PA massimi

Il giocatore decide se i suoi PA massimi seguiranno **Agility** o **Endurance**. Scelta permanente.

### 6.4 Tag Skills

Si scelgono **3 abilità classiche** che il personaggio padroneggia (es. Armi da Fuoco, Scasso, Scienza, Riparazione, Persuasione, Furtività, Medicina, Sopravvivenza, Atletica, Esplosivi). Per ognuna si sceglie un livello di Maestria iniziale: **Competente**, **Esperto**, o **Maestro** (vedi §7). Il giocatore distribuisce 3 livelli totali, in qualunque combinazione (es. 3 Competenti, oppure 1 Competente + 1 Esperto + 1 Maestro, oppure 1 Maestro + 2 niente, ecc.).

### 6.5 Tappi iniziali

Il personaggio inizia con un numero di **tappi** pari al suo valore di **Luck** (al massimo 4 alla creazione). Nessun bobblehead alla creazione. Vedi §12 per il sistema economico.

### 6.6 Equipaggiamento iniziale

Il personaggio inizia con: un'arma a sua scelta (uno o due Tag positivi), un capo d'armatura leggero o medio, 1d6 rottami, 2 stimpack, e un piccolo oggetto significativo per il background (una foto, una lettera, un giocattolo).

---

## 7. Tag Skills e Maestria

Le Tag Skills sono **permessi narrativi**: dichiarano che il personaggio ha la formazione, l'esperienza o l'attitudine per affrontare un certo tipo di problema in modo non improvvisato.

### 7.1 A cosa servono le Tag Skills

- **Permettono di tentare azioni che richiedono training specifico.** Senza la Tag Skill *Scienza* non si può tentare di disarmare una bomba a fissione: il personaggio semplicemente non sa da dove cominciare. Senza *Medicina* non si può fare un intervento chirurgico in campo. Il GM è l'arbitro finale di cosa richiede una skill.
- **Sbloccano la possibilità di spendere PA per ritirare i dadi falliti.** Senza la Tag Skill pertinente, non si può ritirare neanche pagando.

### 7.2 I tre livelli di Maestria

Tutti e tre i livelli abilitano il giocatore a **spendere 1 PA per ritirare i dadi falliti** in un tiro che usa quella skill. La differenza è cosa succede al **Livello di Rischio del ritiro**:

| Livello | Effetto sul ritiro |
|---|---|
| **Competente** | Spendi 1 PA per ritirare. **Il Rischio del tiro sale di un grado** sul ritiro. |
| **Esperto** | Spendi 1 PA per ritirare. Il Rischio del tiro resta **invariato** sul ritiro. |
| **Maestro** | Spendi 1 PA per ritirare. **Il Rischio del tiro scende di un grado** sul ritiro. |

I livelli **non sono cumulativi**: un Maestro non è anche Esperto e Competente, è semplicemente un Maestro.

> *Il Competente è uno specialista grezzo: sa fare la cosa, ma quando si forza il successo c'è il rischio che peggiori. L'Esperto la fa con sicurezza. Il Maestro la fa con tale eleganza che il ritiro è meno pericoloso del tentativo iniziale.*
>
> *Nota: il sistema attualmente non prevede avanzamento. I personaggi nascono con i livelli scelti in creazione e non li modificano in gioco.*

---

## 8. Salute, Logoramento e Condizioni

Non esistono punti ferita. La salute del personaggio è rappresentata dal **Tracciato del Logoramento**: una scheda con **4 slot vuoti** in cui si annotano le **Condizioni** subite.

### 8.1 Le Condizioni

Una Condizione è un **descrittore narrativo di danno** che occupa 1 slot e impone, in modo rigido, **-1 dado** in tutti i tiri pertinenti alla Condizione stessa. Le quattro categorie standard sono:

| Condizione | Categoria | Esempi narrativi | Tiri penalizzati |
|---|---|---|---|
| **Ferito** | Fisica | Braccio rotto, ferita aperta, costole incrinate. | Tutti i tiri di Strength e Agility. |
| **Stremato** | Fisica/Endurance | Affaticamento estremo, intossicazione, fame/sete grave. | Tutti i tiri di Endurance e azioni prolungate. |
| **Irradiato** | Fisica | Esposizione a radiazioni, ustioni da raggi gamma. | Tutti i tiri di Endurance e azioni fisiche pesanti. |
| **Scosso** | Mentale | Trauma, paura, allucinazioni, panico. | Tutti i tiri di Charisma, Intelligence e Perception. |

A queste si aggiungono **Condizioni speciali** generate dalla narrazione (es. *In Down* da Chems, *Cieco*, *Sordo*) che il GM applica nei contesti pertinenti.

### 8.2 Come si guadagnano le Condizioni

Il GM applica una Condizione come conseguenza di:
- Un fallimento in Posizione Rischiosa.
- Un fallimento in Posizione Pericolosa (in questo caso può essere una Condizione grave o multipla, o lo Stato Critico).
- Un evento narrativo specifico (cadere da un piano, restare ore al sole nel deserto, attraversare una zona radioattiva).

### 8.3 Stato Critico

Quando un personaggio dovrebbe ricevere una **quinta Condizione** (con i 4 slot già pieni), entra in **Stato Critico**.

In Stato Critico:
- Il personaggio **non può agire** finché non viene rimossa almeno una Condizione (riposo, intervento medico, stimpack, scena di soccorso da parte di un compagno).
- Il GM decide narrativamente se il personaggio è **incosciente** (svenuto, in coma, collassato) o **cosciente ma immobilizzato** (a terra, paralizzato dal dolore, in shock). La differenza ha conseguenze narrative ma non meccaniche.
- **La morte non avviene mai per meccanica.** Un personaggio muore solo per scelta narrativa esplicita: il giocatore lo decide, oppure il gruppo concorda che la situazione narrativa lo richiede. Lo Stato Critico, da solo, non uccide mai.

### 8.4 Come si rimuovono le Condizioni

- **Riposo in luogo sicuro:** rimuove 1 Condizione standard (Ferito, Stremato, Scosso). Non rimuove *Irradiato* né *In Down* di un personaggio dipendente.
- **Stimpack:** rimuove 1 Condizione fisica (Ferito o Stremato).
- **RadAway:** rimuove la Condizione *Irradiato*.
- **Cure mediche specializzate** (un medico, una struttura, un'apparecchiatura): possono rimuovere Condizioni gravi o permanenti.
- **Addictol:** non rimuove Condizioni, ma elimina alla radice il Tratto *Dipendente da Sostanza* (vedi §9).

---

## 9. Chems, Alcol e Dipendenza

I Chems offrono potenti vantaggi temporanei in cambio di prezzi fisiologici. Il sistema gestisce il loro uso in **tre fasi**.

### 9.1 Le tre fasi dell'uso di sostanze

**Fase 1 — L'High (Effetto Attivo).**
Quando una sostanza viene assunta, il personaggio ottiene un **Tag positivo temporaneo** che dura per l'intera scena, accompagnato da uno **svantaggio narrativo specifico**.

**Fase 2 — Il Down (Crollo).**
Quando l'effetto svanisce, il personaggio subisce automaticamente la Condizione *In Down*. Questa:
- **Occupa 1 slot del Tracciato del Logoramento.**
- Impone un rigido **-1 dado a TUTTI i tiri**, qualunque Approccio o skill si usi.
- Si rimuove con **un riposo in luogo sicuro** (eccezione: vedi Fase 3).

**Fase 3 — L'Assuefazione (Dipendenza Cronica).**
Se un personaggio assume una sostanza mentre è già *In Down*, deve effettuare un **tiro di Endurance**. Il Master dichiara la Posizione di Rischio (di solito Rischiosa).
- **Successo:** la sostanza fa effetto normalmente, nessuna conseguenza ulteriore.
- **Fallimento:** il personaggio sblocca organicamente il **Tratto Negativo *Dipendente da [Sostanza]***.

**Effetti del Tratto *Dipendente***:
- La Condizione *In Down* di quella sostanza **non si cura più con il riposo**: solo una nuova dose la rimuove temporaneamente, oppure l'uso di **Addictol**.
- A scelta del giocatore in fase di sblocco: o il personaggio ha **-1 ai PA massimi permanenti**, o il Master guadagna **1 PSF aggiuntivo** da spendere per scene di astinenza, ricerca disperata della dose, perdita di credibilità.

### 9.2 Lista delle sostanze

| Sostanza | High (Tag positivo) | Svantaggio dell'High | Down |
|---|---|---|---|
| **Psycho** | *Inarrestabile*: il personaggio ignora i malus delle sue Condizioni fisiche per la durata della scena. | Impossibile usare Approcci basati su Intelligence o su Charisma pacifico. Solo aggressività. | Crollo violento, *In Down* a fine scena. |
| **Jet** | +1 PA extra immediato, oppure permesso narrativo di agire per primo in qualunque scena di concitazione. | Frenesia incontrollata: impossibile compiere azioni di precisione, mira fine, lavoro di manualità. | Crollo da Jet, *In Down*. |
| **Mentats** | Successo automatico **oppure** ritiro gratuito su una prova di Intelligence o di scienza/tecnologia. | Ipersensibilità sensoriale: vulnerabile a Condizioni mentali (*Scosso*) in caso di fallimento. | Forte emicrania, *In Down*. |
| **Alcol** (birra, liquori, vino) | Coraggio liquido: vantaggio in tiri di Strength bruta o di Charisma intimidatorio. | Riflessi e raziocinio annebbiati: Agility e Intelligence limitate. | Post-sbornia, *In Down*. |
| **Stimpack** | Rimuove 1 Condizione fisica (Ferito o Stremato). Non è un Chem, non genera Down né Dipendenza. | — | — |
| **RadAway** | Rimuove la Condizione *Irradiato*. Non è un Chem, non genera Down né Dipendenza. | — | — |
| **Addictol** | **Rimuove definitivamente il Tratto Negativo *Dipendente da Sostanza*** alla radice. Estremamente raro. | Non cura Condizioni fisiche né *In Down* in corso: agisce solo sull'Assuefazione cronica. | — |

---

## 10. Equipaggiamento, Tag Narrativi e Modding

### 10.1 Tag Narrativi

Le armi e le armature non hanno valori numerici. Hanno **Tag Narrativi**: parole-chiave che descrivono cosa l'oggetto **permette di fare** o **come si comporta** nella fiction.

I Tag non sono modificatori meccanici fissi: sono **permessi narrativi aperti**. Non esiste una lista esaustiva di effetti per ogni Tag — sono il GM e i giocatori a decidere, momento per momento, se e come un Tag entra in gioco in una scena. Un'arma *Silenziata* può permettere di sparare senza dare l'allarme, ma anche di nascondersi meglio dopo lo sparo, o di non svegliare chi dorme nella stanza accanto. Il principio è: **se il Tag è narrativamente rilevante, entra in gioco; se non lo è, non esiste in quella scena.**

---

### 10.2 Tag Base e Tag Extra

Ogni oggetto ha due categorie di Tag.

**Tag Base:** definiscono l'identità fondamentale dell'oggetto. Descrivono cos'è e come funziona: il materiale di un'armatura, il tipo di meccanismo di un'arma. Non possono essere rimossi in circostanze normali, ma possono essere **danneggiati**.

**Tag Extra:** modificatori aggiuntivi, acquisiti tramite modding, ritrovamenti particolari o ricompense narrative. Possono essere guadagnati e, a differenza dei Tag Base, possono essere **persi definitivamente** per rottura, danneggiamento irreparabile o penalità narrativa.

> *Una corazza in cuoio ha Tag Base **Cuoio**. Se un artigiano ci applica delle piastre metalliche di recupero, acquisisce il Tag Extra **Rinforzata**. Se quel rinforzo si frantuma in combattimento, il Tag Extra **Rinforzata** può essere perso per sempre — ma la corazza è ancora una corazza di cuoio.*

---

### 10.3 Esempi di Tag

**Tag per armi:**

| Tag | Tipo | Permessi narrativi |
|---|---|---|
| **Proiettili** | Base | L'arma è balistica. Può incepparsi (vedi §10.4). |
| **Laser** | Base | Arma energetica a raggio focalizzato. Non si inceppa (vedi §10.5). |
| **Plasma** | Base | Arma energetica ad alta instabilità. Non si inceppa (vedi §10.5). |
| **Esplosiva** | Base | Colpisce un'area, distrugge coperture, fa rumore enorme. |
| **Pesante** | Base o Extra | Grande potenza; può colpire più bersagli ravvicinati, spaccare coperture, intimidire. |
| **Perforante** | Extra | Penetra le corazze; ignora il Tag *Corazza Spessa* o equivalenti sui nemici. |
| **Silenziata** | Extra | Non produce rumore; permette di attaccare senza allertare. |
| **Affidabile** | Extra | Robusta e ben tenuta; ignora la prima volta in cui il GM dichiara un inceppamento o danneggiamento. |
| **Lunga Gittata** | Extra | Efficace a grandi distanze; neutralizza le penalità di distanza. |

**Tag per armature:**

| Tag | Tipo | Permessi narrativi |
|---|---|---|
| **Cuoio** | Base | Protezione leggera, silenziosa, flessibile. |
| **Metallo** | Base | Protegge bene dai colpi cinetici e dalle armi da taglio. Può permettere di ignorare la prima ferita Rischiosa per scena. |
| **Rinforzata** | Extra | Strato aggiuntivo di protezione; assorbe un colpo in più. |
| **Stealth** | Extra | Vantaggio in furtività; vulnerabile in scontro diretto. |
| **Anti-radiazioni** | Extra | Protegge dalla Condizione *Irradiato* in ambienti contaminati. |
| **Resistente all'Energia** | Extra | Riduce gli effetti delle armi a Energia. |

---

### 10.4 Armi Balistiche: Inceppamento e Rottura

Le armi a proiettili (fucili, pistole, mitragliatrici, shotgun) sono le più comuni nel Wasteland, ma sono soggette a **inceppamento**.

**Quando un'arma balistica si inceppa**, il suo Tag Base (es. *Proiettili*) viene **danneggiato**. Un'arma con il Tag Base danneggiato non può essere usata finché non viene riparata o forzata.

L'inceppamento avviene:
- Come conseguenza diretta di un fallimento (in Posizione Rischiosa o Pericolosa, a discrezione del GM).
- Come effetto di un PSF speso dal Master, anche indipendentemente dal risultato di un tiro.

**Forzare un'arma inceppata.**
In momenti disperati, invece di ripararla il giocatore può tentare di **forzarne l'uso**. Si effettua un tiro usando Strength o Agility abbinati alla skill pertinente (di solito Riparazione). La Posizione di Rischio è dichiarata dal GM (in genere Rischiosa).

| Risultato | Effetto |
|---|---|
| **Successo Pieno (6)** | L'arma si disinceppa e torna pienamente funzionante anche per le azioni successive. |
| **Successo con Costo (4-5)** | L'arma funziona per quell'azione, ma **si rompe definitivamente** alla fine della scena. |
| **Fallimento (1-3)** | L'arma **si rompe definitivamente** subito. |

---

### 10.5 Armi Energetiche: Destabilizzazione e Rottura

Le armi energetiche (laser, plasma e simili) sono più rare e costose delle armi balistiche, ma hanno un vantaggio critico: **non si inceppano mai**. In compenso, sono tecnologicamente fragili e soggette a **destabilizzazione**.

**Un'arma energetica stabile** garantisce **+1 dado** al tiro in cui viene usata, indipendentemente dall'approccio scelto. È la precisione e la potenza affidabile di una tecnologia che funziona come deve.

**Quando un'arma energetica si destabilizza**, il suo Tag Base (es. *Laser* o *Plasma*) viene **danneggiato**. L'arma può ancora essere usata, ma **perde il bonus di +1 dado** finché non viene riparata. La destabilizzazione avviene nelle stesse circostanze dell'inceppamento balistico — fallimento o PSF del Master — ma non blocca l'arma: la indebolisce soltanto.

**Se un'arma energetica destabilizzata si rompe** (tramite Conseguenza Critica o PSF del Master), la perdita di controllo di celle o fasci può **infliggere conseguenze al personaggio che la impugna o a chi gli sta vicino**: una Condizione, danni ambientali, o altro a discrezione del GM.

| Stato | Effetto |
|---|---|
| **Stabile** | +1 dado al tiro in cui viene usata. |
| **Destabilizzata** | Nessun bonus. Può ancora essere usata normalmente. |
| **Rotta** | Inutilizzabile. Possibile esplosione o danno collaterale. |

---

### 10.6 Armature: Danneggiamento

Un'armatura protegge finché il suo Tag Base è integro. Quando **il Tag Base viene danneggiato** (es. *Metallo* crepato, *Cuoio* squarciato), l'armatura **non garantisce più i suoi permessi narrativi di protezione**: non assorbe colpi, non ignora ferite.

I Tag Extra restano funzionanti se non sono stati anch'essi colpiti separatamente.

---

### 10.7 Tag Danneggiati

Qualunque Tag — Base o Extra — può essere **danneggiato** individualmente. Un Tag danneggiato è **inattivo**: non entra in gioco finché non viene riparato. Non genera permessi, non offre benefici, non può essere invocato nella narrazione.

I Tag Extra possono anche essere **persi definitivamente** (per Conseguenza Critica, rottura o decisione narrativa del GM). Un Tag Extra perso non si recupera con una riparazione: va guadagnato di nuovo, se mai sarà possibile.

I Tag Base non possono essere persi definitivamente, a meno che l'oggetto stesso non si rompa del tutto.

---

### 10.8 Riparazione

**In campo (condizioni non ottimali — tempo scarso, risorse limitate):**

Si effettua un tiro usando Agility o Intelligence abbinati alla skill pertinente (di solito Riparazione; Scienza per le armi energetiche). Costo fisso: **1 rottame**. Con un **Successo Pieno**, il Tag è riparato e torna funzionante. Con un **Successo con Costo**, il Tag è riparato, ma si spende **1 rottame extra** come complicazione. Con un **Fallimento**, la riparazione non riesce e il rottame è sprecato.

Alcune riparazioni richiedono una Tag Skill specifica: senza di essa, il tiro non si può tentare.

**In calma (luogo sicuro, tempo adeguato):**

Nessun tiro richiesto. Si spende **1 rottame e il tempo necessario**. Anche in questo caso, se la riparazione è tecnica, serve la skill pertinente.

| Condizione | Tiro richiesto? | Costo base | Costo con Successo con Costo |
|---|---|---|---|
| **In campo** | Sì | 1 rottame | +1 rottame |
| **In calma** | No | 1 rottame | — |

> *Riparare non significa "tornare come nuovo": narrativamente, un'arma rattoppata in campo porta ancora il segno del lavoro fatto in fretta. Il GM può tenerne conto.*

---

### 10.9 Rottura Definitiva

Un oggetto **rotto** non può più essere riparato. Può solo essere **smontato per ottenere rottami**: produce tanti rottami quanti erano i Tag positivi che possedeva al momento della rottura. Lo stesso vale per le armature.

Un oggetto si rompe quando:
- Il tiro di **forzatura** di un'arma inceppata produce Successo con Costo o Fallimento.
- Il Master spende un **PSF per Conseguenza Critica** su un fallimento, scegliendo di saltare lo stato di danneggiato e rompere direttamente l'oggetto.

---

### 10.10 Rottami e Modding

I **Rottami** sono **un'unica risorsa generica** che rappresenta tutti i materiali utili recuperabili: componenti meccaniche, schede elettroniche, reagenti chimici, pezzi di metallo, fili di rame, vetro, plastica. Nessuna sottocategoria, nessuna gestione separata.

I rottami si ottengono frugando in luoghi adatti (officine, laboratori, edifici abbandonati, cadaveri di robot e sintetici), come ricompensa di scene narrative, smontando oggetti rotti, oppure spendendo un PF per *Lampo di Genio*.

Ai **Banchi da Lavoro** (officine, garage, laboratori) si possono spendere rottami per modificare e potenziare l'equipaggiamento. Le operazioni di modding richiedono un tiro di Agility o Intelligence abbinato alla skill pertinente, esattamente come la riparazione in campo — a meno che non si disponga di tutto il tempo necessario, nel qual caso non serve tirare.

| Operazione | Costo |
|---|---|
| Riparare un Tag danneggiato | 1 rottame |
| Aggiungere un nuovo Tag Extra all'oggetto | (numero di Tag positivi già presenti) + 1 rottami |
| Costruire oggetti consumabili (mine, granate, cure mediche di fortuna) | Variabile, a discrezione del GM |

> *Esempio: una pistola laser ha già due Tag (**Laser**, **Affidabile**). Aggiungere un terzo Tag Extra (es. **Silenziata**) costa 2 + 1 = 3 rottami. Aggiungerne un quarto costerebbe 4 rottami.*

I costi dei consumabili sono indicativi: il GM può alzarli o abbassarli in base alla rarità del banco e alla complessità della richiesta.

---

## 11. Il Master, l'Iniziativa e i Nemici (Sistema Asimmetrico)

### 11.1 Il GM non tira dadi

Il Master di questo gioco non lancia mai dadi. Le sue azioni e quelle dei nemici **scaturiscono dai fallimenti dei giocatori**, dai PSF spesi, e dalle conseguenze narrative dichiarate.

Quando un giocatore fallisce un tiro, il GM sceglie una conseguenza appropriata al Livello di Rischio. Quando il GM vuole un'escalation, spende PSF.

### 11.2 Iniziativa: il Sistema dei Protagonisti

Quando inizia una scena concitata — di combattimento o no — non si segue un ordine di iniziativa fisso, ma un **sistema a protagonisti**.

**Il flusso della scena:**

1. Il **Master narra** la situazione: cosa accade, chi fa cosa, com'è disposto l'ambiente, qual è la minaccia o la pressione del momento.
2. A sua **discrezione narrativa**, il Master indica un personaggio come **protagonista della situazione**: quel personaggio ha il riflettore puntato addosso, e **deve reagire**. Non è possibile passare il turno: il protagonista deve fare qualcosa, anche solo dichiarare di tergiversare o cercare riparo.
3. Il giocatore protagonista dichiara la sua azione e tira (se serve).
4. Il **Master descrive l'impatto** dell'azione sulla situazione: come cambiano le cose, cosa si muove, chi reagisce.
5. Il Master **sceglie il prossimo protagonista** (può essere lo stesso di prima o un altro) e ricomincia il ciclo.

La scena prosegue così finché non si chiude narrativamente: i nemici sono eliminati, il party fugge, viene catturato, una negoziazione subentra, il pericolo svanisce.

### 11.3 Rubare la Scena

In qualsiasi momento, un giocatore può **spendere 1 PA per Rubare la Scena**: dichiara di intervenire prima che il Master proceda con il prossimo protagonista, e diventa lui il protagonista dell'istante. Si può Rubare la Scena anche **subito dopo aver appena agito**, sia prima che il Master abbia descritto l'impatto della propria azione precedente, sia dopo.

> *Questo permette mosse audaci: agire e poi rincalzare immediatamente con una seconda azione, intervenire per salvare un compagno, prendersi un momento drammatico in qualunque istante.*

**Limite anti-abuso:** se Rubare la Scena è usato in catena (più volte di fila dallo stesso personaggio, o subito dopo un'azione appena fatta), **solo la prima azione della catena può generare PA dai 6**. Le azioni successive nella stessa catena non generano PA, anche se il tiro produce 6 multipli. Questo evita loop in cui un giocatore con molti PA potrebbe rigenerarsi PA all'infinito rubando la scena ripetutamente.

### 11.4 Struttura di un Nemico

Ogni nemico ha tre statistiche narrative:

| Tipo | Resistenza | Esempi |
|---|---|---|
| **Gregario** | 1 colpo | Predone novellino, mole rat, ratto, ghoul selvatico debole. |
| **Veterano** | 3 colpi | Mercenario esperto, super mutante, capo predone, deathclaw giovane. |
| **Boss** | 5+ colpi | Leader di fazione, deathclaw alfa, behemoth, robot militare, mostro unico. |

Un "colpo" è un'azione riuscita dei giocatori che, narrativamente, **infligge danno significativo** al nemico (un colpo di pistola ben piazzato, una spada nello stomaco, un'esplosione). Ferite leggere o azioni di disturbo non contano.

In aggiunta, ogni nemico ha:

- **Tag** — regole speciali che descrivono come va affrontato. Esempi:
  - *Corazza Spessa* (Deathclaw): le armi normali fanno solo metà danno (un colpo conta come mezzo) finché non si usa un'arma *Perforante* o si attacca un punto debole tramite V.A.T.S.
  - *Veloce* (Cane mutante): chi attacca da lontano e fallisce subisce automaticamente una Condizione *Ferito*.
  - *Comandante* (Capo predone): finché è in vita, gli altri predoni non scappano.
  - *Macchina* (Robot militare): immune a *Scosso*, immune a Chems, vulnerabile a EMP e armi a Energia.
- **Istinto** — la "mossa" narrativa che il Master usa quando un giocatore fallisce contro di lui, o quando il nemico è scelto come elemento attivo di una situazione. Ogni nemico ha 1-3 Istinti. Esempi:
  - Deathclaw → *Salta addosso e dilania*: una Condizione *Ferito* grave o lo Stato Critico immediato.
  - Predone con coltello → *Ti afferra e ti punta la lama alla gola*: scena di ostaggio.
  - Robot con torretta → *Attiva la modalità di allarme*: arrivano rinforzi nella scena.

### 11.5 Come strutturare uno scontro

1. Il GM descrive l'arena, i nemici visibili, e la situazione iniziale.
2. Il GM sceglie il primo protagonista (di solito il personaggio più immediatamente coinvolto, ma è discrezione narrativa).
3. Il protagonista dichiara cosa fa. Per ogni azione che richiede tiro, il GM dichiara il Livello di Rischio.
4. Su successo, il GM descrive l'effetto (un colpo a un Gregario lo elimina; a un Veterano lo ferisce visibilmente).
5. Su fallimento, il GM applica un Istinto del nemico o una Condizione narrativa.
6. Il GM passa al prossimo protagonista, oppure un giocatore Ruba la Scena.
7. Si prosegue finché non si chiude la scena.

Il GM dovrebbe pensare ai nemici come **strumenti narrativi**: non vince chi "sopravvive", vince chi crea la scena più memorabile.

---

## 12. Economia: Tappi e Bobblehead

### 12.1 I Tappi

La valuta corrente nel mondo è il **tappo di bottiglia** (cap). I tappi sono **scarsi**: un personaggio inizia con un numero di tappi pari al suo valore di **Luck** (al massimo 4 alla creazione). Trovarne, accumularne e spenderne con cautela è parte integrante del gioco.

**Costo astratto.** I prezzi dei consumabili e dei piccoli oggetti sono in genere arrotondati a **1 tappo**: questo non significa che ogni cosa abbia esattamente lo stesso valore reale — è un'astrazione di gioco. Quel "1 tappo" rappresenta il costo standard di un acquisto qualunque ben condotto, senza scendere in microcontabilità.

**Il limite vero non è il prezzo, è la disponibilità.** Un mercante non ha scorte infinite. Un commerciante girovago può avere 2 stimpack e nessun Psycho; un negozio di una piccola comunità può avere RadAway ma nessuna munizione di un certo calibro. Anche se un giocatore ha tappi a sufficienza, **non può comprare più di quello che il mercante effettivamente possiede**. Il GM stabilisce a sua discrezione cosa è disponibile in ogni mercato. Medicinali, droghe e munizioni speciali tendono a essere particolarmente difficili da reperire.

### 12.2 I Bobblehead

I **bobblehead** sono le iconiche statuette Vault-Tec: oggetti fisici rari, spesso in condizioni perfette, considerati piccoli capolavori industriali sopravvissuti alla guerra. Funzionano come **valuta straordinaria**, riservata agli oggetti **fuori scala** che nessuna persona ragionevole può pagare in tappi.

Un bobblehead rappresenta un costo che **eccede ciò che si può ragionevolmente trasportare in tappi**. È una valuta "di prestigio" usata per:

- Armi pesanti uniche (fat-man, fucili al plasma militari, Gauss).
- Armature potenti complete (set di Power Armor, corazze di alta tecnologia).
- Veicoli funzionanti.
- Proprietà immobiliari (una casa in una città fortificata, un bunker sicuro).

**Difficilmente qualcosa costa più di 2 bobblehead.** I costi a 2 bobblehead sono per oggetti leggendari o servizi quasi inaccessibili.

I bobblehead **non si trovano alla creazione del personaggio**. Si guadagnano in gioco come ricompense narrative significative (il bottino di un'avventura intera, un dono di un capo fazione riconoscente, un ritrovamento eccezionale in un Vault).

Un bobblehead può talvolta essere **scambiato in tappi**, ma il cambio non è mai favorevole: chi lo accetta sa di stare ricevendo qualcosa di unico e impone le sue condizioni.

---

## 13. Esempio di Gioco Esteso

> *Per mostrare come tutte queste regole si combinano in pratica, ecco un esempio di scena giocata.*

**Personaggi presenti:**
- **Marta**, umana, S 2 / P 4 / E 2 / C 3 / I 3 / A 3 / L 1. PA max = Agility = 3. Tappi iniziali = Luck = 1. Tag Skills: *Armi da Fuoco* (Esperta), *Furtività* (Competente), *Scasso* (Competente). Equipaggiamento: pistola laser (*Energia*, *Affidabile*), giubbotto di pelle (*Stealth*).
- **Boris**, supermutante, S 4 / P 2 / E 4 / C 1 / I 1 / A 2 / L 2. PA max = Endurance = 4. Tappi iniziali = Luck = 2. Tag Skills: *Atletica* (Maestro), *Sopravvivenza* (Competente), *Esplosivi* (Competente). Equipaggiamento: mazza chiodata (*Pesante*), corazza pesante (*Metallo*).

**Pool di Punti Fortuna:** 2 PF (sono in due al tavolo).

---

**GM:** Vi siete intrufolati nel garage abbandonato, ma sentite voci. Tre predoni stanno smontando un'auto. Uno di loro ha un cane mutante al guinzaglio. La situazione è tesa: vi vedranno tra pochi secondi. Marta, sei sulla soglia, in penombra. Sei tu protagonista. Cosa fai?

**Marta:** Voglio prenderli di sorpresa. Tiro fuori la pistola laser e cerco di mirare al guinzaglio del cane per liberarlo — magari attacca il padrone. Uso Perception, attivo il V.A.T.S.: il vantaggio situazionale è che il cane è ancora distratto e nessuno mi ha notata. L'effetto narrativo: liberare il cane perché morda il padrone.

**GM:** Vantaggio coerente, effetto plausibile. Posizione **Rischiosa** — se fallisci, il cane ti vede prima e abbaia, allertando tutti. Costa 1 PA per il V.A.T.S. Hai 3 PA, ne resta 2. Tira 4 dadi (Perception 4).

**Marta:** *(tira)* 6, 6, 3, 2.

**GM:** Successo Pieno! E hai un secondo 6: recuperi 1 PA, torni a 3. Il raggio laser taglia il guinzaglio: il cane mutante esita un istante, ringhia, e si lancia sul padrone. Caos totale. Boris, tocca a te. Hai due predoni ancora svegli — uno con un fucile a pompa, uno con una chiave inglese — e un cane che sta sbranando il terzo.

**Boris:** Carica! Voglio addosso al predone con il fucile prima che spari. Uso Strength, lo investo con la mazza.

**GM:** Posizione **Rischiosa**. Tira 4 dadi.

**Boris:** *(tira)* 4, 3, 2, 1.

**GM:** Niente 6, ma hai un 4. Successo con Costo. La mazza colpisce e abbatte il predone, ma nello slancio inciampi su un copertone. *Costo:* il predone con la chiave inglese ti raggiunge alle spalle e ti dà una botta. Prendi la Condizione **Ferito**.

**Boris:** Boris ha 1 slot di Logoramento occupato.

**GM:** Resta il predone con la chiave inglese, e il cane impegnato col padrone. Marta, è di nuovo il tuo turno — il predone col fucile è a terra ma vivo, sta riprendendosi.

**Marta:** Voglio finirlo prima che si rialzi. Sparo di nuovo, Perception. Niente V.A.T.S. stavolta, è già a terra disarmato.

**GM:** Posizione **Sicura** — è atterrato, non si difende. Se fallisci, ti perdi solo l'occasione e si rialza.

**Marta:** *(tira 4 dadi)* 2, 2, 1, 1.

**Marta:** Disastro.

**GM:** Sì. Prendi tempo a mirare, lui rotola via, riprende il fucile. Ora è di nuovo in piedi. Sarei pronto a passare al prossimo protagonista, ma...

**Marta:** Aspetta, voglio spendere 1 PF per *Lampo di Genio*. Mi guardo intorno: dico che sul banco da lavoro vedo una granata frag dimenticata.

**GM:** *(prende il PF, ora ha 1 PSF)* Va bene. La vedi. È a tre passi da te. Boris, sei tu protagonista adesso.

**Boris:** Io carico il predone con la chiave inglese. Strength di nuovo.

**GM:** **Rischiosa**.

**Boris:** *(tira 4 dadi)* 6, 6, 4, 2.

**GM:** Successo Pieno e hai un secondo 6: recuperi 1 PA. La mazza spacca la chiave inglese, il predone vola a terra. Resta solo quello col fucile, che ha appena finito di ricaricare.

**Marta:** Spendo 1 PA per **Rubare la Scena**. Voglio prendere la granata e lanciarla prima che lui spari.

**GM:** Concesso. Hai 2 PA ora.

**Marta:** Prendo la granata, la lancio sul predone superstite.

**GM:** Bene, è una granata, è un'arma *Esplosiva*. Posizione **Rischiosa** — se sbagli mira, esplode vicino a Boris. Tira Perception, sono 4 dadi. Però — un attimo. Il predone sta proprio per sparare, quindi sei sotto pressione. Ti do **Svantaggio**: rimuoverò il dado più alto dopo il tiro.

**Marta:** Voglio usare *Fortuna* invece. Solo per giocarmela.

**GM:** Ok. Fortuna 1 ti dà 1 dado. E la posizione sale a **Pericolosa**. Lo Svantaggio resta.

**Marta:** Spendo 1 PF per riportarla a **Rischiosa**.

**GM:** *(ora ho 2 PSF)* Concesso. Tira 1 dado, ma se ci fosse un secondo dado da rimuovere... ah, ne hai solo uno. Lo Svantaggio è ininfluente in questo caso.

**Marta:** *(tira)* 6.

**GM:** Per il rotto della cuffia — la granata atterra esattamente ai piedi del predone. Esplosione. È finito. Il cane mutante intanto ha sbranato il terzo. Avete vinto la scena. Un colpo alla porta del garage. Voci all'esterno: "Ehi, che è stato 'sto botto?" Arrivano altri tre predoni. Volete combattere o nascondervi?

**Boris:** Sono ferito e abbiamo già speso 2 PF... nascondersi.

**Marta:** Concordo.

**GM:** Va bene, descrivetemi come vi nascondete e tiriamo Furtività...

---

> *In questa scena breve abbiamo usato: tutti i Livelli di Rischio, V.A.T.S. con vantaggio situazionale ed effetto narrativo, recupero di PA tramite 6 multipli, Successo con Costo, applicazione di una Condizione, Approccio Fortuna con aumento e mitigazione del rischio, Svantaggio dichiarato dal GM, spesa di PF per Lampo di Genio, sistema dei protagonisti, Rubare la Scena, e gestione asimmetrica del GM (nessun tiro dei nemici).*

---

*Fine del manuale completo. Documento WIP — soggetto a revisione.*
