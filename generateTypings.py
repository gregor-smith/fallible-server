from argparse import ArgumentParser


def main():
    parser = ArgumentParser()
    parser.add_argument('--overloads', type=int, default=9)
    overloads: int = parser.parse_args().overloads

    for i in range(2, overloads + 2):
        print('export function composeMessageHandlers<')
        for j in range(1, i + 1):
            print(f'    State{j},')
        print(f'    State{i + 1}')
        print('>(')
        print('    handlers: [')
        for j in range(1, i + 1):
            print(f'        MessageHandler<State{j}, State{j + 1}>,')
        print('    ]')
        print(f'): MessageHandler<State1, State{i + 1}>')


if __name__ == "__main__":
    main()
