{
  description = "SlayZone — Desktop task management with integrated AI coding assistants";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-darwin" "x86_64-darwin" ] (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        sources = builtins.fromJSON (builtins.readFile ./nix/sources.json);
        src = sources.${system} or (throw "Unsupported system: ${system}");
        version = sources.version;
        pname = "slayzone";

        linuxPackage = pkgs.appimageTools.wrapType2 {
          inherit pname version;
          src = pkgs.fetchurl {
            url = src.url;
            sha256 = src.sha256;
          };
          extraInstallCommands =
            let
              appimageContents = pkgs.appimageTools.extractType2 {
                inherit pname version;
                src = pkgs.fetchurl {
                  url = src.url;
                  sha256 = src.sha256;
                };
              };
            in ''
              install -m 444 -D ${appimageContents}/slayzone.desktop $out/share/applications/slayzone.desktop
              substituteInPlace $out/share/applications/slayzone.desktop \
                --replace-warn 'Exec=AppRun' 'Exec=${pname}'
              cp -r ${appimageContents}/usr/share/icons $out/share/icons 2>/dev/null || true
            '';
        };

        darwinPackage = pkgs.stdenv.mkDerivation {
          inherit pname version;
          src = pkgs.fetchurl {
            url = src.url;
            sha256 = src.sha256;
          };
          sourceRoot = ".";
          nativeBuildInputs = [ pkgs.unzip ];
          installPhase = ''
            mkdir -p $out/Applications
            cp -r SlayZone.app $out/Applications/
          '';
        };

      in {
        packages.default = if pkgs.stdenv.isLinux then linuxPackage else darwinPackage;

        apps.default = {
          type = "app";
          program = if pkgs.stdenv.isLinux
            then "${self.packages.${system}.default}/bin/${pname}"
            else "${self.packages.${system}.default}/Applications/SlayZone.app/Contents/MacOS/SlayZone";
        };
      }
    );
}
