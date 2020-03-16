const { version } = require('../../package.json')
// tslint:disable:no-trailing-whitespace
export function printLogo(): void {
  console.log(`
  
##############################################################################################################################

    RRRRRRRRRRRRRRRRR   EEEEEEEEEEEEEEEEEEEEEE        GGGGGGGGGGGGG               AAA               XXXXXXX       XXXXXXX
    R::::::::::::::::R  E::::::::::::::::::::E     GGG::::::::::::G              A:::A              X:::::X       X:::::X
    R::::::RRRRRR:::::R E::::::::::::::::::::E   GG:::::::::::::::G             A:::::A             X:::::X       X:::::X
    RR:::::R     R:::::REE::::::EEEEEEEEE::::E  G:::::GGGGGGGG::::G            A:::::::A            X::::::X     X::::::X
      R::::R     R:::::R  E:::::E       EEEEEE G:::::G       GGGGGG           A:::::::::A           XXX:::::X   X:::::XXX
      R::::R     R:::::R  E:::::E             G:::::G                        A:::::A:::::A             X:::::X X:::::X   
      R::::RRRRRR:::::R   E::::::EEEEEEEEEE   G:::::G                       A:::::A A:::::A             X:::::X:::::X    
      R:::::::::::::RR    E:::::::::::::::E   G:::::G    GGGGGGGGGG        A:::::A   A:::::A             X:::::::::X     
      R::::RRRRRR:::::R   E:::::::::::::::E   G:::::G    G::::::::G       A:::::A     A:::::A            X:::::::::X     
      R::::R     R:::::R  E::::::EEEEEEEEEE   G:::::G    GGGGG::::G      A:::::AAAAAAAAA:::::A          X:::::X:::::X    
      R::::R     R:::::R  E:::::E             G:::::G        G::::G     A:::::::::::::::::::::A        X:::::X X:::::X   
      R::::R     R:::::R  E:::::E       EEEEEE G:::::G       G::::G    A:::::AAAAAAAAAAAAA:::::A    XXX:::::X   X:::::XXX
    RR:::::R     R:::::REE::::::EEEEEEEE:::::E  G:::::GGGGGGGG::::G   A:::::A             A:::::A   X::::::X     X::::::X
    R::::::R     R:::::RE::::::::::::::::::::E   GG:::::::::::::::G  A:::::A               A:::::A  X:::::X       X:::::X
    R::::::R     R:::::RE::::::::::::::::::::E     GGG::::::GGG:::G A:::::A                 A:::::A X:::::X       X:::::X
    RRRRRRRR     RRRRRRREEEEEEEEEEEEEEEEEEEEEE        GGGGGG   GGGGAAAAAAA                   AAAAAAAXXXXXXX       XXXXXXX
    
    version: ${version}
    
##############################################################################################################################
                                                                                                                     
`)
}
