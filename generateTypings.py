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

    print('\n')

    for i in range(2, overloads + 2):
        print('export function composeResultMessageHandlers<')
        for j in range(1, i + 1):
            print(f'    State{j}, Error{j},')
        print(f'    State{i + 1}')
        print('>(')
        print('    handlers: [')
        print('        MessageHandler<State1, Result<State2, Error1>>,')
        for j in range(2, i + 1):
            error = ' | '.join(f'Error{k}' for k in range(1, j))
            print(f'        MessageHandler<State{j}, Result<State{j + 1}, {error} | Error{j}>>,')
        print('    ]')
        error = ' | '.join(f'Error{j}' for j in range(1, i + 1))
        print(f'): MessageHandler<State1, Result<State{i + 1}, {error}>>')


if __name__ == "__main__":
    main()
