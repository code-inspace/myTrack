            <h3 className="text-base font-bold text-white">
              Activation sur iPhone & iPad
            </h3>

            <p className="text-xs text-[#8E929E] leading-relaxed text-left">
              Pour recevoir les notifications push sur iOS :
              <br /><br />
              1. Clique sur le bouton <strong>Partager</strong> en bas de Safari (icône carré avec flèche vers le haut).
              <br />
              2. Fais défiler et sélectionne <strong>« Sur l'écran d'accueil »</strong>.
              <br />
              3. Ouvre l'application <strong>MyTrack</strong> depuis ton écran d'accueil et clique sur « Activer les notifications ».
            </p>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#D4F63D] text-black font-bold text-xs cursor-pointer"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
